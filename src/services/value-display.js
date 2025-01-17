(function() {
    "use strict";

    var mod = angular.module('ods-widgets');

    mod.service('ValueDisplay', ['$filter', 'translate', function($filter, translate) {
        var valueFormatters = {
            'language': function(value) {
                return $filter('isocode_to_language')(value);
            },
            'visualization': function(value) {
                switch (value) {
                    case 'analyze':
                        return '<i class="odswidget-facet__value-icon fa fa-bar-chart"></i> ' + translate('Analyze');
                    case 'calendar':
                        return '<i class="odswidget-facet__value-icon fa fa-calendar"></i> ' + translate('Calendar');
                    case 'geo':
                        return '<i class="odswidget-facet__value-icon fa fa-globe"></i> ' + translate('Map');
                    case 'image':
                        return '<i class="odswidget-facet__value-icon fa fa-picture-o"></i> ' + translate('Image');
                    case 'api':
                        return '<i class="odswidget-facet__value-icon fa fa-cogs"></i> ' + translate('API');
                    default:
                        return value;

                }
            }
        };

        return {
            format: function(value, valueType) {
                if (angular.isDefined(valueFormatters)) {
                    return valueFormatters[valueType](value);
                }
                console.log('Warning (ValueDisplay): unknown value formatter "'+valueType+'"');
                return value;
            }
        };
    }]);
}());