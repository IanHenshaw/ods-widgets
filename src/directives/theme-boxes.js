(function() {
    'use strict';
    var mod = angular.module('ods-widgets');

    mod.directive('odsThemeBoxes', function() {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsThemeBoxes
         * @scope
         * @restrict E
         * @param {CatalogContext} context {@link ods-widgets.directive:odsCatalogContext Catalog Context} to pull the theme list from.
         * @param {string} facetName Name of the facet to enumerate
         * @description
         * This widget enumerates the themes available on the domain, by showing their pictos and the number of datasets they contain.
         * They require the `themes` setting to be configured in {@link ods-widgets.ODSWidgetsConfigProvider ODSWidgetsConfig}.
         */
        return {
            restrict: 'E',
            replace: false,
            template: '<div class="odswidget odswidget-theme-boxes">' +
                '<ods-facet-enumerator context="context" facet-name="theme">' +
                    '<a ng-href="{{context.domainUrl}}/explore/?refine.theme={{item.path}}" target="_self" ods-tooltip="{{item.name}} ({{item.count}} jeux de données)" ods-tooltip-direction="bottom" style="display: block;">' +
                        '<ods-theme-picto theme="{{item.name}}"></ods-theme-picto>' +
                    '</a>' +
                '</div>' +
                '</ods-facet-enumerator>' +
                '</div>',
            scope: {
                context: '='
            }
        };
    });

}());