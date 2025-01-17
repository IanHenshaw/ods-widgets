(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsTable', ['ODSWidgetsConfig', '$sce', function(ODSWidgetsConfig, $sce) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsTable
         * @restrict E
         * @scope
         * @param {DatasetContext} context {@link ods-widgets.directive:odsDatasetContext Dataset Context} to use
         * @param {string} [displayedFields=all] A comma-separated list of fields to display. By default all the available fields are displayed.
         *
         * @description
         * This widget displays a table view of a dataset, with infinite scroll and an ability to sort columns (depending on the
         * types of the column).
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-dataset-context context="stations" stations-domain="public.opendatasoft.com" stations-dataset="jcdecaux_bike_data">
         *              <ods-table context="stations"></ods-table>
         *          </ods-dataset-context>
         *      </file>
         *  </example>
         */
        return {
            restrict: 'E',
            scope: {
                context: '=',
                displayedFields: '@',
                sort: '@',
                datasetFeedback: '@' // FIXME: This is entirely tied to ODS, which is bad
            },
            replace: true,
            transclude: true,
            require: ['odsTable','?odsAutoResize', '?autoResize'],
            template: '<div class="records records-table odswidget odswidget-table">' +
                       ' <div class="odswidget-table__header" ng-show="records.length">' +
                       '     <table class="odswidget-table__internal-table">' +
                       '         <thead class="odswidget-table__internal-header-table-header">' +
                       '         <tr>' +
                       '             <th class="odswidget-table__header-cell odswidget-table__header-cell--spinner"><div class="odswidget-table__cell-container"><ods-spinner ng-show="fetching" class="odswidget-spinner--large"></ods-spinner></div></th>' +
                       '             <th class="odswidget-table__header-cell" ng-repeat="field in context.dataset.fields|fieldsForVisualization:\'table\'|fieldsFilter:displayedFieldsArray"' +
                       '                 title="{{ field.description || field.label }}"' +
                       '                 ng-click="toggleSort(field)"' +
                       '                 >' +
                       '                 <div class="odswidget-table__header-cell-container">' +
                       '                     <span ng-bind="field.label"></span>' +
                       '                     <div ng-class="{\'odswidget-table__sort-icons\': true, \'odswidget-table__sort-icons--active\': field.name == context.parameters.sort || \'-\'+field.name == context.parameters.sort}" ng-show="isFieldSortable(field)">' +
                       '                         <i class="fa fa-chevron-up odswidget-table__sort-icons__up" ng-hide="isAscendingSorted(field)"></i>' +
                       '                         <i class="fa fa-chevron-down odswidget-table__sort-icons__down" ng-hide="isDescendingSorted(field)"></i>' +
                       '                     </div>' +
                       '                 </div>' +
                       '             </th>' +
                       '         </tr>' +
                       '         </thead>' +
                       '     </table>' +
                       ' </div>' +
                       ' <div class="odswidget-table__records">' +
                       '     <table class="odswidget-table__internal-table" infinite-scroll="loadMore()" infinite-scroll-distance="1" infinite-scroll-disabled="fetching">' +
                       '         <thead class="odswidget-table__internal-table-header">' +
                       '             <tr>' +
                       '                 <th class="odswidget-table__header-cell odswidget-table__header-cell--spinner"><div class="odswidget-table__cell-container"><ods-spinner ng-show="fetching" class="odswidget-spinner--large"></ods-spinner></div></th>' +
                       '                 <th class="odswidget-table__header-cell" ng-repeat="field in context.dataset.fields|fieldsForVisualization:\'table\'|fieldsFilter:displayedFieldsArray"' +
                       '                     title="{{ field.name }}">' +
                       '                     <div class="odswidget-table__cell-container">' +
                       '                         <span ng-bind="field.label"></span>' +
                       '                         <div class="odswidget-table__sort-icons" ng-show="isFieldSortable(field)">' +
                       '                             <i class="fa fa-chevron-up odswidget-table__sort-icons__up"></i>' +
                       '                             <i class="fa fa-chevron-down odswidget-table__sort-icons__down"></i>' +
                       '                         </div>' +
                       '                     </div>' +
                       '                 </th>' +
                       '             </tr>' +
                       '         </thead>' +
                       '         <tbody class="odswidget-table__records-tbody">' +
                       '         </tbody>' +
                       '     </table>' +
                       ' </div>' +
                       ' <div ng-if="displayDatasetFeedback" class="table-feedback-new"><a ods-dataset-feedback ods-dataset-feedback-dataset="context.dataset"><i class="fa fa-comment"></i> <span translate>Suggest a new record</span></a></div>' +
                       ' <div class="odswidget-overlay" ng-hide="fetching || records"><span class="odswidget-overlay__message" translate>No results</span></div>' +
                       ' <div class="odswidget-overlay" ng-hide="(!fetching || records) && !working"><ods-spinner></ods-spinner></div>' +
                    '</div>',
            controller: ['$scope', '$element', '$timeout', '$document', '$window', 'ODSAPI', 'DebugLogger', '$filter', '$http', '$compile', '$transclude', '$q', function($scope, $element, $timeout, $document, $window, ODSAPI, DebugLogger, $filter, $http, $compile, $transclude, $q) {
                var ctrl = this;
                $scope.displayedFieldsArray = null;

                $scope.displayDatasetFeedback = false;
                // Infinite scroll parameters
                $scope.page = 0;
                $scope.resultsPerPage = 40;
                $scope.fetching = false;
                // New records are appended to the end of this array
                $scope.records = [];
                $scope.working = true;

                // Use to store the columns width to apply to the table.
                // Due to the fix header, we need to apply this to the fake header and the table body.
                $scope.layout = [];

                // End of the infinite scroll
                $scope.done = false;

                // Needed to construct the table
                var datasetFields, recordsHeader = $element.find('.odswidget-table__header'), recordsBody = $element.find('.odswidget-table__records-tbody');

                var initScrollLeft = recordsHeader.offset().left;
                var prevScrollLeft = 0; // Use to know if it is a horizontal or vertical scroll
                var lastScrollLeft = 0; // To keep the horizontal scrollbar position when refining or sorting
                var forceScrollLeft = false; // Only reset the horizontal scrollbar position when refining or sorting

                // Use to keep track of the records currently visible for the users
                var lastStartIndex = 0, lastEndIndex = 0;

                var extraRecords = 100; // Number of extraneous records before & after
                var startIndex = 0, endIndex = 0; // Records between startIndex and endIndex are in the DOM

                var id = Math.random().toString(36).substring(7);
                var tableId = 'table-' + id;
                var styleSheetId = 'stylesheet-' + id;

                var currentRequestsTimeouts = [];

                var $infiniteScrollElement;

                var refreshRecords = function(init) {
                    $scope.fetching = true;
                    var options = {}, start;

                    if (init) {
                        $scope.done = false;
                        $scope.page = 0;
                        $scope.records = [];
                        start = 0;
                        if (currentRequestsTimeouts.length) {
                            currentRequestsTimeouts.forEach(function(t) {t.resolve();});
                            currentRequestsTimeouts.splice(0, currentRequestsTimeouts.length);
                        }
                    } else {
                        $scope.page++;
                        start = $scope.page * $scope.resultsPerPage;
                    }
                    jQuery.extend(options, $scope.staticSearchOptions, $scope.context.parameters, {start: start});

                    // Retrieve only the displayed fields
                    if ($scope.displayedFieldsArray &&
                        $scope.context.dataset.fields.length > $scope.displayedFieldsArray.length) {
                        jQuery.extend(options, {fields: $scope.displayedFieldsArray.join(',')});
                    }

                    if (options.sort) {
                        // If there is a sort parameter on a field that doesn't exist, we remove it. The idea is to ensure that
                        // if there is an embed somewhere with a sort in the URL, we don't want to completely break it if the publisher
                        // changes the name of the field: we just want to cancel the sort.
                        var sortedFieldName = options.sort.replace('-', '');
                        if (!$scope.context.dataset.getField(sortedFieldName)) {
                            delete options.sort;
                        }
                    }

                    var timeout = $q.defer();
                    currentRequestsTimeouts.push(timeout);

                    ODSAPI.records.search($scope.context, options, timeout.promise).
                        success(function(data, status, headers, config) {
                            if (!data.records.length) {
                                $scope.working = false;
                            }

                            $scope.records = init ? data.records : $scope.records.concat(data.records);
                            $scope.nhits = data.nhits;

                            $scope.error = '';
                            $scope.fetching = false;
                            $scope.done = ($scope.page+1) * $scope.resultsPerPage >= data.nhits;

                            currentRequestsTimeouts.splice(currentRequestsTimeouts.indexOf(timeout), 1);
                        }).
                        error(function(data, status, headers, config) {
                            if (data) {
                                // Errors without data are cancelled requests
                                $scope.error = data.error;
                            }
                            currentRequestsTimeouts.splice(currentRequestsTimeouts.indexOf(timeout), 1);
                            $scope.fetching = false;
                        });
                };

                // Automatically called by ng-infinite-scroll
                $scope.loadMore = function() {
                    if (!$scope.fetching && !$scope.done && $scope.staticSearchOptions) {
                        refreshRecords(false);
                    }
                };

                $scope.isFieldSortable = function(field) {
                    return ODS.DatasetUtils.isFieldSortable(field);
                };

                $scope.isAscendingSorted = function(field) {
                    if (field.type === 'text') {
                        return field.name === $scope.context.parameters.sort;
                    } else {
                        return '-'+field.name === $scope.context.parameters.sort;
                    }
                };

                $scope.isDescendingSorted = function(field) {
                    if (field.type === 'text') {
                        return '-'+field.name === $scope.context.parameters.sort;
                    } else {
                        return field.name === $scope.context.parameters.sort;
                    }
                };

                $scope.toggleSort = function(field){
                    // Not all the sorts are supported yet
                    if($scope.isFieldSortable(field)){
                        // Reversing an existing sort
                        if($scope.context.parameters.sort == field.name){
                            $scope.context.parameters.sort = '-' + field.name;
                            return;
                        }
                        if($scope.context.parameters.sort == '-' + field.name){
                            $scope.context.parameters.sort = field.name;
                            return;
                        }
                        // Ascending is "-" for numeric
                        $scope.context.parameters.sort = field.type === 'text' ? field.name : '-'+field.name;
                    } else {
                        delete $scope.context.parameters.sort;
                    }
                };

                // Is there a custom template into the directive's tag?
                var customTemplate = false;
                $transclude(function(clone) {
                    clone.contents().wrapAll('<div>');
                    customTemplate = clone.contents().length > 0 && clone.contents().html().trim().length > 0;
                });

                var renderOneRecord = function(index, records, position) {
                    /*
                     <tr ng-repeat="record in records">
                         <td bindonce="field" ng-repeat="field in dataset.fields|fieldsForVisualization:'table'|fieldsFilter:dataset.extra_metas.visualization.table_fields" ng-switch="field.type">
                             <div>
                                 <span ng-switch-when="geo_point_2d">
                                     <geotooltip width="300" height="300" coords="record.fields[field.name]">{{ record.fields|formatFieldValue:field }}</geotooltip>
                                 </span>
                                 <span ng-switch-when="geo_shape">
                                    <geotooltip width="300" height="300" geojson="record.fields[field.name]">{{ record.fields|formatFieldValue:field|truncate }}</geotooltip>
                                 </span>
                                 <span ng-switch-default bo-title="record.fields|formatFieldValue:field" bo-html="record.fields|formatFieldValue:field|linky|nofollow"></span>
                             </div>
                         </td>
                     </tr>
                     */

                    // The following code does almost the same as above.
                    // Originally, it was in the angular template "records-table.html" but for performance issue
                    // all the work is done here without using angular.


                    var tr, td, record = records[index];

                    tr = document.createElement('tr');
                    tr.className = 'odswidget-table__internal-table-row record-'+index;

                    // TODO: Don't use jQuery if there is performance issue.
                    if (position === 'end') {
                        var beforePlaceholder = $element.find('.js-placeholder-bottom')[0];
                        beforePlaceholder.parentNode.insertBefore(tr, beforePlaceholder);
                    } else {
                        var afterPlaceholder = $element.find('.js-placeholder-top')[0];
                        afterPlaceholder.parentNode.insertBefore(tr, afterPlaceholder.nextSibling);
                    }

                    // Insert the record number
                    td = document.createElement('td');
                    td.className = 'odswidget-table__cell';
                    var div = document.createElement('div');
                    div.className = 'odswidget-table__cell-container';

                    if ($scope.displayDatasetFeedback) {
                        // FIXME: This is entirely tied to ODS platform, it should not be within a widget
                        var feedbackButton = '<i class="fa fa-comment table-feedback-icon" ods-dataset-feedback ods-dataset-feedback-record="record" ods-dataset-feedback-dataset="dataset" ods-tooltip="Suggest changes for this record" translate="ods-tooltip"></i>';
                        var localScope = $scope.$new(true);
                        localScope.record = record;
                        localScope.dataset = $scope.context.dataset;
                        div.appendChild($compile(feedbackButton)(localScope)[0]);
                    }

                    div.appendChild(document.createTextNode(index+1));
                    td.appendChild(div);
                    tr.appendChild(td);

                    for (var j=0; j<datasetFields.length; j++) {
                        var field = datasetFields[j];
                        var fieldValue = $filter('formatFieldValue')(record.fields, field);

                        td = document.createElement('td');
                        td.className = 'odswidget-table__cell';
                        tr.appendChild(td);

                        div = document.createElement('div');
                        div.className = 'odswidget-table__cell-container';
                        td.appendChild(div);

                        var newScope, node;
                        if (customTemplate) {
                            // Inject the custom template and a few carefully selected variables
                            newScope = $scope.$new(true);
                            newScope.record = record;
                            newScope.currentField = field.name;
                            newScope.currentValue = record.fields[field.name];
                            newScope.currentFormattedValue = fieldValue;
                            node = $compile('<div inject></div>', $transclude)(newScope)[0];
                        } else {
                            newScope = $scope.$new(false);
                            newScope.recordFields = record.fields[field.name];

                            if (field && field.type === 'geo_point_2d') {
                                newScope.fieldValue = fieldValue;
                                node = $compile('<ods-geotooltip width="300" height="300" coords="recordFields">' + fieldValue + '</ods-geotooltip>')(newScope)[0];
                            } else if (field && field.type === 'geo_shape') {
                                newScope.fieldValue = $filter('truncate')(fieldValue);
                                node = $compile('<ods-geotooltip width="300" height="300" geojson="recordFields">' + fieldValue + '</ods-geotooltip>')(newScope)[0];
                            } else if (field && field.type === 'file') {
                                var html = $filter('nofollow')($filter('prettyText')(fieldValue)).toString();
                                html = html.replace(/<a /, '<a ods-resource-download-conditions ');
                                if (!html) {
                                    node = document.createElement('span');
                                } else {
                                    node = $compile(html)(newScope)[0];
                                    node.title = record.fields[field.name] ? record.fields[field.name].filename : '';
                                }
                            } else {
                                node = document.createElement('span');
                                node.title = fieldValue;
                                node.innerHTML = $filter('nofollow')($filter('prettyText')(fieldValue));
                            }
                        }
                        div.appendChild(node);
                    }

                    return tr;
                };

                var deleteOneRecord = function(index) {
                    var record = $element[0].getElementsByClassName('record-'+index)[0];
                    if (record) {
                        record.parentNode.removeChild(record);
                    }
                };

                var getRowRecordNumber = function(rowTr) {
                    var num;
                    angular.forEach(rowTr.classList, function(className) {
                        if (className.startsWith('record-')) {
                            num = parseInt(className.substr(7), 10);
                        }
                    });
                    return num;
                };

                var displayRecords = function() {
                    var offsetHeight = $element.find('.odswidget-table__records')[0].offsetHeight;
                    var scrollTop = $element.find('.odswidget-table__records')[0].scrollTop;
                    var recordHeight = recordsBody.find('tr').eq(1).height(); // First row is the placeholder

                    // Compute the index of the records that will be visible = that we have in the DOM
                    // TODO: Don't use jQuery if there is performance issue.
                    var placeholderTop = $element.find('.js-placeholder-top')[0];
                    var placeholderBot = $element.find('.js-placeholder-bottom')[0];

                    if(recordHeight) {
                        startIndex = Math.max(Math.floor((scrollTop - (extraRecords * recordHeight)) / recordHeight), 0);
                        endIndex = Math.min(Math.ceil((scrollTop + offsetHeight + (extraRecords * recordHeight)) / recordHeight), $scope.records.length);
                    } else {
                        startIndex = 0;
                        endIndex = $scope.records.length;
                    }
                    startIndex = startIndex && startIndex%2 ? startIndex+1 : startIndex;

                    var scrollDown = startIndex - lastStartIndex > 0 || endIndex - lastEndIndex > 0;

                    // Skip if it is already done
                    if (startIndex === lastStartIndex && endIndex === lastEndIndex) {
                        return;
                    }

                    // Hide the element to prevent intermediary renderings
                    // $element.hide();

                    // Insert placeholder tr
                    var tr, trInDom, visible, count, i, newHeight;

                    if (!placeholderTop) {
                        tr = document.createElement('tr');
                        tr.className = 'js-placeholder-top';
                        tr.style.height = '0px';
                        recordsBody[0].appendChild(tr);
                        placeholderTop = $element.find('.js-placeholder-top')[0];
                    }

                    if (!placeholderBot) {
                        tr = document.createElement('tr');
                        tr.className = 'js-placeholder-bottom';
                        tr.style.height = '0px';
                        recordsBody[0].appendChild(tr);
                        placeholderBot = $element.find('.js-placeholder-bottom')[0];
                    }

                    if (!$scope.layout.length && $scope.records.length) {
                        var numberRecordsToRender = Math.min($scope.records.length, $scope.resultsPerPage);

                        for (i=0; i<numberRecordsToRender; i++) {
                            renderOneRecord(i, $scope.records, 'end');
                        }
                    }
                    else {
                        if (scrollDown) {
                            for (i=0; i<startIndex; i++) {
                                deleteOneRecord(i);
                            }

                            //debugger;

                            placeholderTop.style.height = startIndex*recordHeight + 'px';

                            trInDom = $element[0].getElementsByTagName('tbody')[0].getElementsByTagName('tr');
                            visible = trInDom.length > 2;
                            var lastRecordNumber = visible ? getRowRecordNumber(trInDom[trInDom.length-2]) : startIndex;

                            count = 0;
                            for (i=lastRecordNumber+1; i<endIndex; i++) {
                                renderOneRecord(i, $scope.records, 'end');
                                count++;
                            }

                            newHeight = visible ? $(placeholderBot).height() - count*recordHeight : ($scope.records.length-endIndex)*recordHeight;
                            newHeight = newHeight > 0 ? newHeight : 0;
                            placeholderBot.style.height = newHeight + 'px';
                        } else {
                            count = 0;
                            for (i=endIndex+1; i<$scope.records.length; i++) {
                                deleteOneRecord(i);
                                count++;
                            }

                            var deltaRecords = ($scope.records.length - (endIndex+1));
                            deltaRecords = deltaRecords >= 0 ? deltaRecords : 0;
                            placeholderBot.style.height = deltaRecords*recordHeight + 'px';

                            trInDom = $element[0].getElementsByTagName('tbody')[0].getElementsByTagName('tr');
                            visible = trInDom.length > 2;
                            var firstRecordNumber = visible ? getRowRecordNumber(trInDom[1]) : endIndex;

                            count = 0;
                            for (i=firstRecordNumber-1; i>=startIndex; i--) {
                                renderOneRecord(i, $scope.records, 'begin');
                                count++;
                            }

                            newHeight = visible ? $(placeholderTop).height() - count*recordHeight : startIndex*recordHeight;
                            newHeight = newHeight > 0 ? newHeight : 0;
                            placeholderTop.style.height = newHeight + 'px';
                        }
                    }

                    // $element.show();

                    lastStartIndex = startIndex;
                    lastEndIndex = endIndex;
                };


                $scope.$watch('records', function(newValue, oldValue) {
                    if (newValue !== oldValue) {
                        displayRecords();
                        $scope.computeLayout();
                        // make sure the view is always filled with records
                        if (!$infiniteScrollElement) {
                            $infiniteScrollElement = $element.find('[infinite-scroll]');
                        }
                        if ($element.height() > $infiniteScrollElement.height()) {
                            $scope.loadMore();
                        }
                    }
                });

                $scope.context.wait().then(function() {
                    if ($scope.displayedFields) {
                        $scope.displayedFieldsArray = $scope.displayedFields.split(',').map(function(item) {return item.trim();});
                    } else {
                        if ($scope.context.dataset.extra_metas &&
                            $scope.context.dataset.extra_metas.visualization &&
                            angular.isArray($scope.context.dataset.extra_metas.visualization.table_fields) &&
                            $scope.context.dataset.extra_metas.visualization.table_fields.length > 0) {
                            $scope.displayedFieldsArray = $scope.context.dataset.extra_metas.visualization.table_fields;
                        } else {
                            $scope.displayedFieldsArray = null;
                        }
                    }

                    if (!$scope.context.parameters.sort && $scope.context.dataset.extra_metas && $scope.context.dataset.extra_metas.visualization && $scope.context.dataset.extra_metas.visualization.table_default_sort_field) {
                        var sortField = $scope.context.dataset.extra_metas.visualization.table_default_sort_field;
                        if ($scope.context.dataset.extra_metas.visualization.table_default_sort_direction === '-') {
                            sortField = '-' + sortField;
                        }
                        $scope.context.parameters.sort = sortField;
                    }

                    $scope.displayDatasetFeedback = $scope.datasetFeedback === 'true' && $scope.context.dataset.getExtraMeta('explore', 'feedback_enabled');

                    $scope.staticSearchOptions = {
                        rows: $scope.resultsPerPage
                    };

                    DebugLogger.log('table -> dataset watch -> refresh records');

                    var fieldsForVisualization = $filter('fieldsForVisualization')($scope.context.dataset.fields, 'table');
                    datasetFields = $filter('fieldsFilter')(fieldsForVisualization, $scope.displayedFieldsArray);

                    refreshRecords(true);

                    $scope.$watch('context.parameters', function(newValue, oldValue) {
                        // Don't fire at initialization time
                        if (newValue === oldValue) return;

                        DebugLogger.log('table -> searchOptions watch -> refresh records');

                        // Reset all variables for next time
                        $scope.layout = []; // Reset layout (layout depends on records data)
                        $scope.working = true;
                        lastScrollLeft = $element.find('.odswidget-table__records')[0].scrollLeft; // Keep scrollbar position
                        forceScrollLeft = true;

                        recordsBody.empty();

                        refreshRecords(true);
                    }, true);

                });



                ctrl.resetScroll = function() {
                    $element.find('.odswidget-table__records').scrollLeft(0);
                    recordsHeader.css({left: 'auto'});
                    initScrollLeft = $element.find('.odswidget-table__header').offset().left;
                };

                var lastRecordDisplayed = 0;
                $element.find('.odswidget-table__records').on('scroll', function() {
                    if (this.scrollLeft !== prevScrollLeft) {
                        // Horizontal scroll
                        recordsHeader.offset({left: initScrollLeft - this.scrollLeft});
                        prevScrollLeft = this.scrollLeft;
                    } else {
                        // Vertical scroll
                        forceScrollLeft = false;
                        var recordDisplayed = Math.max(Math.floor(($element.find('.odswidget-table__records')[0].scrollTop) / recordsBody.find('tr').eq(1).height()), 0);

                        if (Math.abs(recordDisplayed-lastRecordDisplayed) < extraRecords && recordDisplayed > startIndex) {
                            return;
                        }

                        lastRecordDisplayed = recordDisplayed;
                        displayRecords();
                    }
                });

                var computeStyle = function(tableId, disableMaxWidth) {
                    var styles = '';
                    for (var i=0; i<$scope.layout.length; i++) {
                        var j = i+1;
                        var maxWidth = disableMaxWidth ? 'max-width: none; ' : ''; // Table with few columns
                        styles += '#' + tableId + ' .odswidget-table__header tr th:nth-child(' + j + ') > div, ' +
                                  '#' + tableId + ' .odswidget-table__records tr td:nth-child(' + j + ') > div ' +
                                  '{ width: ' + $scope.layout[i] + 'px; ' + maxWidth + '} ';

                    }
                    return styles;
                };

                $scope.computeLayout = function() {
                    var elementHeight;
                    var rows = $element.find('.odswidget-table__internal-table-row');

                    var padding = 22; // 22 = 2*paddingDiv + 2*paddingTh = 2*10 + 2*1

                    if (!$scope.layout.length && $scope.records.length) {
                        if (!$element.attr('id')) {
                            $element.attr('id', tableId);
                        }

                        if ($element.hasClass('odswidget-table--embedded')) {
                            elementHeight = $(window).height() - $element.offset().top;
                            $element.height(elementHeight);
                        } else {
                            elementHeight = $element.height();
                        }
                        var bodyOffset = 0;
                        if ($scope.displayDatasetFeedback) {
                            bodyOffset = $element.find('.table-feedback-new').height() + 5;
                        }
                        $element.find('.odswidget-table__records').height(elementHeight - 25 - bodyOffset); // Horizontal scrollbar height

                        var recordHeight = recordsBody.find('tr').eq(1).height();
                        var bodyHeight = (rows.length-2)*recordHeight; // Don't take in account placeholders

                        // Remove previous style
                        var node = document.getElementById(styleSheetId);
                        if (node && node.parentNode) {
                            node.parentNode.removeChild(node);
                        }

                        // Switch between the fake header and the default header
                        $element.find('.odswidget-table__internal-header-table-header').hide();
                        $element.find('.odswidget-table__internal-table-header').show();

                        var totalWidth = 0;
                        angular.forEach($element.find('.odswidget-table__internal-table-header .odswidget-table__cell-container'), function (thDiv, i) {
                            $scope.layout[i] = $(thDiv).width() + 8; // For sortable icons
                            totalWidth += $scope.layout[i];
                        });
                        $scope.layout[0] = 30; // First column is the record number

                        // WARNING: The following lines are commented because they caused the bug in CH #1401
                        // Commenting them doesn't seem to change anything to the expected behaviour, but the code is
                        // left here nonetheless should issues appear.

                        //var tableWidth = $element.find('.odswidget-table__internal-table').width();
                        //var tableFewColumns = (totalWidth + padding * $scope.layout.length) < $element.width();
                        //
                        //if (tableFewColumns) {
                        //    var toAdd = Math.floor(tableWidth / $scope.layout.length);
                        //    var remaining = tableWidth - toAdd * $scope.layout.length;
                        //
                        //    // Dispatch the table width between the other columns
                        //    for (var i = 1; i < $scope.layout.length; i++) {
                        //        $scope.layout[i] = toAdd - padding;
                        //    }
                        //    $scope.layout[$scope.layout.length - 1] += remaining;
                        //
                        //    // Scrollbar is here: too many records
                        //    if (bodyHeight > 500) {
                        //        $element.find('.odswidget-table__internal-header-table').width(tableWidth);
                        //    } else {
                        //        $element.find('.odswidget-table__internal-header-table').width('');
                        //    }
                        //}

                        // Append new style
                        var css = document.createElement('style');
                        // WARNING: goes with the commented block above
                        //var styles = computeStyle(tableId, tableFewColumns);
                        var styles = computeStyle(tableId, false);

                        css.id = styleSheetId;
                        css.type = 'text/css';

                        if (css.styleSheet) {
                            css.styleSheet.cssText = styles;
                        } else {
                            css.appendChild(document.createTextNode(styles));
                        }

                        $element[0].appendChild(css);

                        // Switch between the default header and the fake header
                        $element.find('.odswidget-table__internal-table-header').hide();
                        $element.find('.odswidget-table__internal-header-table-header').show();

                        if (!forceScrollLeft) {
                            $timeout(function () {
                                ctrl.resetScroll();
                            }, 0);
                        }
                    }

                    // Restore previous horizontal scrollbar position
                    if (forceScrollLeft) {
                        if (!lastScrollLeft) {
                            recordsHeader.css({left: 'auto'});
                        }
                        $element.find('.odswidget-table__records')[0].scrollLeft = lastScrollLeft;
                    }

                    if ($scope.layout.length) {
                        $scope.working = false;
                    }
                };

            }],
            link: function(scope, element, attrs, ctrls) {
                var ctrl = ctrls[0],
                    autoResizeCtrl = ctrls[1] || ctrls[2];
                if (autoResizeCtrl !== null) {
                    autoResizeCtrl.onResize = function() {
                        ctrl.resetScroll();
                        scope.layout = [];
                        scope.computeLayout();
                    };
                }
            }
        };
    }]);

}());