(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.filter('nofollow', function() {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:nofollow
         *
         * @function
         * @param {string} html A string of html code.
         * @return {string} The input html code with all link tags now including the attributes `target="_blank"` and 
         * `rel="nofollow"`
         */
        return function(value) {
            if (angular.isString(value)) {
                return value.replace(/<a href="/g, '<a target="_blank" rel="nofollow" href="');
            } else {
                return value;
            }
        };
    });

    mod.filter('prettyText', ['$filter', function($filter) {
        /**
         * Prepares a text value to be displayed
         */
        var re = /[<>]+/;
        // I stole this part from angular-sanitize
        var NON_ALPHANUMERIC_REGEXP = /([^\#-~| |!])/g;
        function encodeEntities(value) {
          return value.
            replace(/&/g, '&amp;').
            replace(NON_ALPHANUMERIC_REGEXP, function(value){
              return '&#' + value.charCodeAt(0) + ';';
            }).
            replace(/</g, '&lt;').
            replace(/>/g, '&gt;');
        }

        return function(value) {
            if (!value || !angular.isString(value)) {
                return value;
            }
            if (re.test(value)) {
                return encodeEntities(value);
            } else {
                return $filter('linky')(value, '_blank');
            }
        };
    }]);

    mod.filter('safenewlines', function () {
        // Used to convert "safe" newlines (from ngSanitize) to <br /> tags
        return function(text) {
            if (!text) {
                return text;
            }
            return text.replace(/\n/g, '<br/>').replace(/&#10;/g, '<br/>');
        };
    });

    mod.filter('imagify', ['$sce', function($sce) {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:imageify
         *
         * @function
         * @param {string} url A url pointing to an image file (with a jpg, jpeg, png or gif extension)
         * @return {string} An `img` tag pointing to the image.
         */
        var re = /^(http(?:s?):\/\/[^;,]*(?:jpg|jpeg|png|gif)(?:\?[^,;]*)?)(?:$|;|,|&)/i;
        return function(value) {
            if (angular.isString(value)) {
                value = value.trim();
                var match = re.exec(value);
                if (match !== null) {
                    // It looks like an image
                    return $sce.trustAsHtml('<img class="odswidget odswidget-imagified" src="' + match[1] + '" />');
                }
            }
            return value;
        };
    }]);

    mod.filter('videoify', ['$sce', function($sce) {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:videoify
         *
         * @function
         * @param {string} url A youtube, dailymotion or vimeo URL.
         * @return {string} An iframe tag including the relevant video player configured with the input url
         */
        // Youtube:
        // http(s)://youtu.be/Hh-0y8Qe0Sw
        // http(s)://(www.)youtube.com/watch?v=Hh-0y8Qe0Sw
        var re_youtube = /^https?:\/\/(?:(?:youtu.be\/)|(?:(?:www.)?youtube.com\/watch\?v=))([0-9a-z_-]+)$/i;

        // Dailymotion
        // http://www.dailymotion.com/video/x2pyhdb_roland-garros-2015-quand-le-stade-de-roland-garros-se-prepare-et-s-affaire_sport
        // http://dai.ly/x2pyhdb
        var re_dailymotion = /^https?:\/\/(?:(?:dai.ly)|(?:www.dailymotion.com))\/(?:video\/)?([0-9a-z]+)(?:[0-9a-z_-]*)$/i;

        // Vimeo
        // https://vimeo.com/127051771
        var re_vimeo = /^https?:\/\/vimeo.com\/([0-9]+)$/i;

        return function(url) {
            if (angular.isString(url)) {
                var match = re_youtube.exec(url.trim());
                if (match !== null) {
                    // The first match is the Youtube ID
                    return $sce.trustAsHtml('<iframe width="200" height="113" src="//www.youtube.com/embed/'+match[1]+'" frameborder="0" allowfullscreen></iframe>');
                }
                match = re_dailymotion.exec(url.trim());
                if (match !== null) {
                    // The first match is the Youtube ID
                    return $sce.trustAsHtml('<iframe frameborder="0" width="200" height="113" src="//www.dailymotion.com/embed/video/'+match[1]+'" allowfullscreen></iframe>');
                }
                match = re_vimeo.exec(url.trim());
                if (match !== null) {
                    // The first match is the Youtube ID
                    return $sce.trustAsHtml('<iframe src="https://player.vimeo.com/video/'+match[1]+'" width="200" height="113" frameborder="0" webkitallowfullscreen mozallowfullscreen allowfullscreen></iframe>');
                }
            }
            return url;
        };
    }]);

    mod.filter('isDefined', function() {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:isDefined
         *
         * @function
         * @param {string|number|Object|Boolean} value Any variable
         * @return {Boolean} true if the value is defined.
         */
        return function(value) {
            return angular.isDefined(value);
        };
    });

    mod.filter('keys', function() {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:keys
         *
         * @function
         * @param {Object} object An object.
         * @return {string[]} The keys of the input object.
         */
        return function(value) {
            return Object.keys(value);
        };
    });

    mod.filter('numKeys', function() {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:numKeys
         *
         * @function
         * @param {Object} object An object.
         * @return {string[]} The number of keys of the input object.
         */
        return function(value) {
            return Object.keys(value).length;
        };
    });

    mod.filter('values', function() {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:values
         *
         * @function
         * @param {Object} object An object.
         * @return {Array} An array containing all of the object's values
         */
        return function(object) {
            var values = [];
            angular.forEach(object, function(value) {
                values.push(value);
            });
            return values;
        };
    });

    mod.filter('isEmpty', function() {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:isEmpty
         *
         * @function
         * @param {Object} object An object.
         * @return {Boolean} Return true if the object is empty (has no key)
         */
        return function(value) {
            return Object.keys(value).length === 0;
        };
    });

    mod.filter('displayImageValue', function($sce) {
        return function(value, datasetid) {
            if (!value) {
                return value;
            }
            var url = '/explore/dataset/'+datasetid+'/files/'+value.id+'/300/';

            return $sce.trustAsHtml('<img class="odswidget odswidget-imagified" src="' + url + '" />');
        };
    });

    mod.filter('fieldsForVisualization', function() {
        var blacklist = {
            'table': [],
            'map': ['geo_point_2d', 'geo_shape'],
            'images': ['file'],
            'calendar': []
        };
        return function(fields, viz) {
            if (angular.isUndefined(fields)) { return fields; }
            if (angular.isUndefined(blacklist[viz])) {
                throw 'Unknown visualization type "' + viz + "'";
            }
            return fields.filter(function(field) { return blacklist[viz].indexOf(field.type) === -1; });
        };
    });

    mod.filter('formatFieldValue', ['$filter', '$sce', function($filter, $sce) {
        var DATASETID_RE = /^\/(explore\/(embed\/)?dataset|publish)\/([\w_@-]+)\//;
        var getPrecision = function(field) {
            if (field.annotations) {
                var annos = field.annotations.filter(function(anno) { return anno.name === 'timeserie_precision'; });
                if (annos.length > 0) {
                    return annos[0].args[0];
                }
            }
            return null;
        };

        return function(record, field) {

            var value = record[field.name];
            if (value === null || value === undefined) {
                return '';
            }

            if (field.type === 'int' || field.type === 'double') {
                var unit = '';
                if (field.annotations) {
                    for (var a=0; a<field.annotations.length; a++) {
                        if (field.annotations[a].name === 'unit') {
                            unit = field.annotations[a].args[0];
                        }
                    }
                }
                var formattedValue = $filter('number')(value);
                if (unit) {
                    if (unit === '$') {
                        formattedValue = unit + formattedValue;
                    } else {
                        formattedValue = formattedValue + ' ' + unit;
                    }
                }
                return  formattedValue;
            } else if (field.type === 'geo_point_2d') {
                return value[0] + ', ' + value[1];
            } else if (field.type === 'geo_shape') {
                return $filter('limitTo')(angular.toJson(value), 200);
            } else if (field.type === 'date') {
                var precision = getPrecision(field);
                if (precision === 'year') {
                    return value;
                } else if (precision === 'month') {
                    // Parse the partial date properly
                    var partialDate = moment(value, 'YYYY-MM');
                    return $filter('capitalize')($filter('moment')(partialDate, 'MMMM YYYY'));
                }
                return $filter('moment')(value, 'LL');
            } else if (field.type === 'datetime') {
                if (value.length === 19) {
                    // Fix for legacy timestamps that don't have a timezone
                    value += 'Z';
                }
                return $filter('moment')(value, 'LLL');
            } else if (field.type === 'file') { // it's 'file' type really
                if (angular.isObject(value)) {
                    // Ugly hack to fix https://github.com/opendatasoft/platform/issues/4019
                    // The idea is that once we have API V2, we'll have an absolute link
                    // https://opendatasoft.clubhouse.io/story/423
                    var datasetID = DATASETID_RE.exec(decodeURIComponent(window.location.pathname))[3];
                    var url = '/explore/dataset/' + datasetID + '/files/'+value.id+'/download/';
                    return $sce.trustAsHtml('<a target="_self" href="' + url + '">' + (value.filename || record.filename) + '</a>');
                } else {
                    return ''+value;
                }
            } else {
                return $filter('limitTo')(''+value, 1000);
            }
        };
    }]);


    mod.filter('capitalize', [function() {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:capitalize
         *
         * @function
         * @param {string} text A string to capitalize
         * @return {string} The input string, capitalized (ie with its first character in capital letter)
         */
        return function(input) {
            return ODS.StringUtils.capitalize(input);
        };
    }]);

    mod.filter('truncate', function() {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:truncate
         *
         * @function
         * @param {string} text Original text to truncate.
         * @param {number} length Max length of the truncated text.
         * @return {string} The `length` first chars of the input `text`, or the full input `text` if it is shorter 
         * than `length`.
         */
        return function(text, length) {
            if (!text || !angular.isString(text)) {
                return text;
            }
            if (!length) {
                length = 200;
            }
            return text.substring(0, length);
        };
    });

    mod.filter('fieldsFilter', function(){
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:fieldsFilter
         *
         * @function
         * @param {string[]} fieldNames A list of field names.
         * @param {Object[]} fields A list of fields as returned by the API.
         * @return {Object[]} A sublist of the `fields` input, containing only fields which are referenced in the 
         * `fieldNames` attribute.
         */
        return function(fields, config){
            if (!fields) {
                return fields;
            }
            if(angular.isArray(config) && config.length) {
                var output = [];
                angular.forEach(config, function(fieldName){
                    var field = $.grep(fields, function(field){ return field.name === fieldName; })[0];
                    if (angular.isDefined(field)) {
                        output.push(field);
                    }
                });
                return output;
            }
            return fields;
        };
    });

    mod.filter('moment', [function() {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:moment
         *
         * @function
         * @description Render a given date in a specified format.
         * @param {string|Date|Number|Array|Moment} date A date
         * @param {string} format See http://momentjs.com/docs/#/displaying/format/ for the full list of options
         * @return {string} The input date, formatted.
         */
        return function(isoDate, format) {
            if (isoDate)
                return moment(isoDate).format(format);
        };
    }]);

    mod.filter('momentadd', [function() {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:momentAdd
         *
         * @function
         * @param {string|Date|Number|Array|Moment} date A date
         * @param {string} precision A unit describing the type of the `number` parameter. Can be any of `years`, 
         * `quarters`, `months`, `weeks`, `days`, `hours`, `minutes`, `seconds` or `milliseconds`.
         * @param {number} number How many years, hours, minutes (depending on `precision`) should be added. Can be a 
         * negative number. 
         * @return {Moment} A date 
         */
        return function(isoDate, precision, number) {
            if (isoDate) {
                return moment(isoDate).add(precision, parseInt(number, 10)).toISOString().replace('.000Z', 'Z');
            }
        };
    }]);

    mod.filter('timesince', [function() {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:timesince
         *
         * @function
         * @param {string|Date|Number|Array|Moment} date A date
         * @return {string} A fully localized string describing the time between the input date and now. For example: 
         * "A few seconds ago"
         */
        return function(isoDate) {
            if (isoDate)
                return moment(isoDate).fromNow();
        };
    }]);


    mod.filter('themeSlug', ['$filter', function($filter) {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:themeSlug
         *
         * @function
         * @param {string} themeName A theme's full name
         * @return {string} The slugified (that is normalized, with dashes instead of spaces) version of themeName.
         */
        return function(value) {
            if (!value || angular.isArray(value) && value.length === 0) {
                return value;
            }
            if (angular.isArray(value)) {
                value = value[0];
            }
            return $filter('slugify')($filter('normalize')(value));
        };
    }]);

    mod.filter('slugify', function(){
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:slugify
         *
         * @function
         * @param {string} text Some text
         * @return {string} The slugified (that is normalized, with dashes instead of spaces) version of the input text.
         */
        return function(text){
            if (!text) {
                return text;
            }
            return ODS.StringUtils.slugify(text);
        };
    });

    mod.filter('normalize', [function() {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:normalize
         *
         * @function
         * @param {string} text Some text
         * @return {string} The text cleaned of all of its diacritical signs.
         */
        // http://stackoverflow.com/questions/990904/javascript-remove-accents-in-strings
        var defaultDiacriticsRemovalMap = [
            {'base':'A', 'letters':/[\u0041\u24B6\uFF21\u00C0\u00C1\u00C2\u1EA6\u1EA4\u1EAA\u1EA8\u00C3\u0100\u0102\u1EB0\u1EAE\u1EB4\u1EB2\u0226\u01E0\u00C4\u01DE\u1EA2\u00C5\u01FA\u01CD\u0200\u0202\u1EA0\u1EAC\u1EB6\u1E00\u0104\u023A\u2C6F]/g},
            {'base':'AA','letters':/[\uA732]/g},
            {'base':'AE','letters':/[\u00C6\u01FC\u01E2]/g},
            {'base':'AO','letters':/[\uA734]/g},
            {'base':'AU','letters':/[\uA736]/g},
            {'base':'AV','letters':/[\uA738\uA73A]/g},
            {'base':'AY','letters':/[\uA73C]/g},
            {'base':'B', 'letters':/[\u0042\u24B7\uFF22\u1E02\u1E04\u1E06\u0243\u0182\u0181]/g},
            {'base':'C', 'letters':/[\u0043\u24B8\uFF23\u0106\u0108\u010A\u010C\u00C7\u1E08\u0187\u023B\uA73E]/g},
            {'base':'D', 'letters':/[\u0044\u24B9\uFF24\u1E0A\u010E\u1E0C\u1E10\u1E12\u1E0E\u0110\u018B\u018A\u0189\uA779]/g},
            {'base':'DZ','letters':/[\u01F1\u01C4]/g},
            {'base':'Dz','letters':/[\u01F2\u01C5]/g},
            {'base':'E', 'letters':/[\u0045\u24BA\uFF25\u00C8\u00C9\u00CA\u1EC0\u1EBE\u1EC4\u1EC2\u1EBC\u0112\u1E14\u1E16\u0114\u0116\u00CB\u1EBA\u011A\u0204\u0206\u1EB8\u1EC6\u0228\u1E1C\u0118\u1E18\u1E1A\u0190\u018E]/g},
            {'base':'F', 'letters':/[\u0046\u24BB\uFF26\u1E1E\u0191\uA77B]/g},
            {'base':'G', 'letters':/[\u0047\u24BC\uFF27\u01F4\u011C\u1E20\u011E\u0120\u01E6\u0122\u01E4\u0193\uA7A0\uA77D\uA77E]/g},
            {'base':'H', 'letters':/[\u0048\u24BD\uFF28\u0124\u1E22\u1E26\u021E\u1E24\u1E28\u1E2A\u0126\u2C67\u2C75\uA78D]/g},
            {'base':'I', 'letters':/[\u0049\u24BE\uFF29\u00CC\u00CD\u00CE\u0128\u012A\u012C\u0130\u00CF\u1E2E\u1EC8\u01CF\u0208\u020A\u1ECA\u012E\u1E2C\u0197]/g},
            {'base':'J', 'letters':/[\u004A\u24BF\uFF2A\u0134\u0248]/g},
            {'base':'K', 'letters':/[\u004B\u24C0\uFF2B\u1E30\u01E8\u1E32\u0136\u1E34\u0198\u2C69\uA740\uA742\uA744\uA7A2]/g},
            {'base':'L', 'letters':/[\u004C\u24C1\uFF2C\u013F\u0139\u013D\u1E36\u1E38\u013B\u1E3C\u1E3A\u0141\u023D\u2C62\u2C60\uA748\uA746\uA780]/g},
            {'base':'LJ','letters':/[\u01C7]/g},
            {'base':'Lj','letters':/[\u01C8]/g},
            {'base':'M', 'letters':/[\u004D\u24C2\uFF2D\u1E3E\u1E40\u1E42\u2C6E\u019C]/g},
            {'base':'N', 'letters':/[\u004E\u24C3\uFF2E\u01F8\u0143\u00D1\u1E44\u0147\u1E46\u0145\u1E4A\u1E48\u0220\u019D\uA790\uA7A4]/g},
            {'base':'NJ','letters':/[\u01CA]/g},
            {'base':'Nj','letters':/[\u01CB]/g},
            {'base':'O', 'letters':/[\u004F\u24C4\uFF2F\u00D2\u00D3\u00D4\u1ED2\u1ED0\u1ED6\u1ED4\u00D5\u1E4C\u022C\u1E4E\u014C\u1E50\u1E52\u014E\u022E\u0230\u00D6\u022A\u1ECE\u0150\u01D1\u020C\u020E\u01A0\u1EDC\u1EDA\u1EE0\u1EDE\u1EE2\u1ECC\u1ED8\u01EA\u01EC\u00D8\u01FE\u0186\u019F\uA74A\uA74C]/g},
            {'base':'OI','letters':/[\u01A2]/g},
            {'base':'OO','letters':/[\uA74E]/g},
            {'base':'OU','letters':/[\u0222]/g},
            {'base':'P', 'letters':/[\u0050\u24C5\uFF30\u1E54\u1E56\u01A4\u2C63\uA750\uA752\uA754]/g},
            {'base':'Q', 'letters':/[\u0051\u24C6\uFF31\uA756\uA758\u024A]/g},
            {'base':'R', 'letters':/[\u0052\u24C7\uFF32\u0154\u1E58\u0158\u0210\u0212\u1E5A\u1E5C\u0156\u1E5E\u024C\u2C64\uA75A\uA7A6\uA782]/g},
            {'base':'S', 'letters':/[\u0053\u24C8\uFF33\u1E9E\u015A\u1E64\u015C\u1E60\u0160\u1E66\u1E62\u1E68\u0218\u015E\u2C7E\uA7A8\uA784]/g},
            {'base':'T', 'letters':/[\u0054\u24C9\uFF34\u1E6A\u0164\u1E6C\u021A\u0162\u1E70\u1E6E\u0166\u01AC\u01AE\u023E\uA786]/g},
            {'base':'TZ','letters':/[\uA728]/g},
            {'base':'U', 'letters':/[\u0055\u24CA\uFF35\u00D9\u00DA\u00DB\u0168\u1E78\u016A\u1E7A\u016C\u00DC\u01DB\u01D7\u01D5\u01D9\u1EE6\u016E\u0170\u01D3\u0214\u0216\u01AF\u1EEA\u1EE8\u1EEE\u1EEC\u1EF0\u1EE4\u1E72\u0172\u1E76\u1E74\u0244]/g},
            {'base':'V', 'letters':/[\u0056\u24CB\uFF36\u1E7C\u1E7E\u01B2\uA75E\u0245]/g},
            {'base':'VY','letters':/[\uA760]/g},
            {'base':'W', 'letters':/[\u0057\u24CC\uFF37\u1E80\u1E82\u0174\u1E86\u1E84\u1E88\u2C72]/g},
            {'base':'X', 'letters':/[\u0058\u24CD\uFF38\u1E8A\u1E8C]/g},
            {'base':'Y', 'letters':/[\u0059\u24CE\uFF39\u1EF2\u00DD\u0176\u1EF8\u0232\u1E8E\u0178\u1EF6\u1EF4\u01B3\u024E\u1EFE]/g},
            {'base':'Z', 'letters':/[\u005A\u24CF\uFF3A\u0179\u1E90\u017B\u017D\u1E92\u1E94\u01B5\u0224\u2C7F\u2C6B\uA762]/g},
            {'base':'a', 'letters':/[\u0061\u24D0\uFF41\u1E9A\u00E0\u00E1\u00E2\u1EA7\u1EA5\u1EAB\u1EA9\u00E3\u0101\u0103\u1EB1\u1EAF\u1EB5\u1EB3\u0227\u01E1\u00E4\u01DF\u1EA3\u00E5\u01FB\u01CE\u0201\u0203\u1EA1\u1EAD\u1EB7\u1E01\u0105\u2C65\u0250]/g},
            {'base':'aa','letters':/[\uA733]/g},
            {'base':'ae','letters':/[\u00E6\u01FD\u01E3]/g},
            {'base':'ao','letters':/[\uA735]/g},
            {'base':'au','letters':/[\uA737]/g},
            {'base':'av','letters':/[\uA739\uA73B]/g},
            {'base':'ay','letters':/[\uA73D]/g},
            {'base':'b', 'letters':/[\u0062\u24D1\uFF42\u1E03\u1E05\u1E07\u0180\u0183\u0253]/g},
            {'base':'c', 'letters':/[\u0063\u24D2\uFF43\u0107\u0109\u010B\u010D\u00E7\u1E09\u0188\u023C\uA73F\u2184]/g},
            {'base':'d', 'letters':/[\u0064\u24D3\uFF44\u1E0B\u010F\u1E0D\u1E11\u1E13\u1E0F\u0111\u018C\u0256\u0257\uA77A]/g},
            {'base':'dz','letters':/[\u01F3\u01C6]/g},
            {'base':'e', 'letters':/[\u0065\u24D4\uFF45\u00E8\u00E9\u00EA\u1EC1\u1EBF\u1EC5\u1EC3\u1EBD\u0113\u1E15\u1E17\u0115\u0117\u00EB\u1EBB\u011B\u0205\u0207\u1EB9\u1EC7\u0229\u1E1D\u0119\u1E19\u1E1B\u0247\u025B\u01DD]/g},
            {'base':'f', 'letters':/[\u0066\u24D5\uFF46\u1E1F\u0192\uA77C]/g},
            {'base':'g', 'letters':/[\u0067\u24D6\uFF47\u01F5\u011D\u1E21\u011F\u0121\u01E7\u0123\u01E5\u0260\uA7A1\u1D79\uA77F]/g},
            {'base':'h', 'letters':/[\u0068\u24D7\uFF48\u0125\u1E23\u1E27\u021F\u1E25\u1E29\u1E2B\u1E96\u0127\u2C68\u2C76\u0265]/g},
            {'base':'hv','letters':/[\u0195]/g},
            {'base':'i', 'letters':/[\u0069\u24D8\uFF49\u00EC\u00ED\u00EE\u0129\u012B\u012D\u00EF\u1E2F\u1EC9\u01D0\u0209\u020B\u1ECB\u012F\u1E2D\u0268\u0131]/g},
            {'base':'j', 'letters':/[\u006A\u24D9\uFF4A\u0135\u01F0\u0249]/g},
            {'base':'k', 'letters':/[\u006B\u24DA\uFF4B\u1E31\u01E9\u1E33\u0137\u1E35\u0199\u2C6A\uA741\uA743\uA745\uA7A3]/g},
            {'base':'l', 'letters':/[\u006C\u24DB\uFF4C\u0140\u013A\u013E\u1E37\u1E39\u013C\u1E3D\u1E3B\u017F\u0142\u019A\u026B\u2C61\uA749\uA781\uA747]/g},
            {'base':'lj','letters':/[\u01C9]/g},
            {'base':'m', 'letters':/[\u006D\u24DC\uFF4D\u1E3F\u1E41\u1E43\u0271\u026F]/g},
            {'base':'n', 'letters':/[\u006E\u24DD\uFF4E\u01F9\u0144\u00F1\u1E45\u0148\u1E47\u0146\u1E4B\u1E49\u019E\u0272\u0149\uA791\uA7A5]/g},
            {'base':'nj','letters':/[\u01CC]/g},
            {'base':'o', 'letters':/[\u006F\u24DE\uFF4F\u00F2\u00F3\u00F4\u1ED3\u1ED1\u1ED7\u1ED5\u00F5\u1E4D\u022D\u1E4F\u014D\u1E51\u1E53\u014F\u022F\u0231\u00F6\u022B\u1ECF\u0151\u01D2\u020D\u020F\u01A1\u1EDD\u1EDB\u1EE1\u1EDF\u1EE3\u1ECD\u1ED9\u01EB\u01ED\u00F8\u01FF\u0254\uA74B\uA74D\u0275]/g},
            {'base':'oi','letters':/[\u01A3]/g},
            {'base':'ou','letters':/[\u0223]/g},
            {'base':'oo','letters':/[\uA74F]/g},
            {'base':'p','letters':/[\u0070\u24DF\uFF50\u1E55\u1E57\u01A5\u1D7D\uA751\uA753\uA755]/g},
            {'base':'q','letters':/[\u0071\u24E0\uFF51\u024B\uA757\uA759]/g},
            {'base':'r','letters':/[\u0072\u24E1\uFF52\u0155\u1E59\u0159\u0211\u0213\u1E5B\u1E5D\u0157\u1E5F\u024D\u027D\uA75B\uA7A7\uA783]/g},
            {'base':'s','letters':/[\u0073\u24E2\uFF53\u00DF\u015B\u1E65\u015D\u1E61\u0161\u1E67\u1E63\u1E69\u0219\u015F\u023F\uA7A9\uA785\u1E9B]/g},
            {'base':'t','letters':/[\u0074\u24E3\uFF54\u1E6B\u1E97\u0165\u1E6D\u021B\u0163\u1E71\u1E6F\u0167\u01AD\u0288\u2C66\uA787]/g},
            {'base':'tz','letters':/[\uA729]/g},
            {'base':'u','letters':/[\u0075\u24E4\uFF55\u00F9\u00FA\u00FB\u0169\u1E79\u016B\u1E7B\u016D\u00FC\u01DC\u01D8\u01D6\u01DA\u1EE7\u016F\u0171\u01D4\u0215\u0217\u01B0\u1EEB\u1EE9\u1EEF\u1EED\u1EF1\u1EE5\u1E73\u0173\u1E77\u1E75\u0289]/g},
            {'base':'v','letters':/[\u0076\u24E5\uFF56\u1E7D\u1E7F\u028B\uA75F\u028C]/g},
            {'base':'vy','letters':/[\uA761]/g},
            {'base':'w','letters':/[\u0077\u24E6\uFF57\u1E81\u1E83\u0175\u1E87\u1E85\u1E98\u1E89\u2C73]/g},
            {'base':'x','letters':/[\u0078\u24E7\uFF58\u1E8B\u1E8D]/g},
            {'base':'y','letters':/[\u0079\u24E8\uFF59\u1EF3\u00FD\u0177\u1EF9\u0233\u1E8F\u00FF\u1EF7\u1E99\u1EF5\u01B4\u024F\u1EFF]/g},
            {'base':'z','letters':/[\u007A\u24E9\uFF5A\u017A\u1E91\u017C\u017E\u1E93\u1E95\u01B6\u0225\u0240\u2C6C\uA763]/g}
        ];
        return function(input) {
            if (!input) {
                return input;
            }
            for(var i=0; i<defaultDiacriticsRemovalMap.length; i++) {
                input = input.replace(defaultDiacriticsRemovalMap[i].letters, defaultDiacriticsRemovalMap[i].base);
            }
            return input;
        };
    }]);

    mod.filter('shortSummary', [function() {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:shortSummary
         *
         * @function
         * @param {string} text Some text
         * @param {number} length The maximum length of the summary
         * @return {string} A short summary from the given text, usually the first paragraph. If longer than the 
         * required length, an ellipsis will be made.
         */
        return function(summary, length) {
            length = length || 400;
            if (!summary) {
                return '';
            }
            // What we want is :
            // - If it starts with text, then this text (up to a potential \n)
            // - Else, try to find a <p> and takes the content
            // - Else, takes the text
            // Then takes up to x words
            var text = '';
            var body = angular.element('<div>'+summary+'</div>');
            if (body.children().length === 0) {
                // Regular text
                if (summary.indexOf('\n') > -1) {
                    text = summary.substring(0, summary.indexOf('\n'));
                } else {
                    text = summary;
                }
            } else {
                var firstNode = body.contents()[0];
                if (firstNode.nodeType == 3) {
                    // Text node
                    text = firstNode.textContent;
                } else {
                    // It doesn't begin with text : is there a <p>?
                    if (body.find('p').length > 0) {
                        var node = body.find('p')[0];
                        if (angular.isDefined(node.textContent)) {
                            text = node.textContent;
                        } else {
                            // Fallback for IE8, loses the \n's
                            text = node.innerText;
                        }
                    } else {
                        // Well, we take what we can get
                        text = body.text();
                    }
                }
            }
            // Limit text length
            if (text.length > length) {
                text = text.substring(0, length-3) + '…';
            }
            return text;
        };
    }]);

    mod.filter('imageUrl', function() {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:imageUrl
         *
         * @function
         * @param {Object} fieldValue A record field of type file
         * @param {DatasetContext|CatalogContext} context The context from which the record is extracted
         * @return {string} A url pointing to the file itself.
         */
        return function(fieldValue, context) {
            if (!fieldValue || angular.equals(fieldValue, {})) {
                return null;
            }
            if (!context) {
                console.log('ERROR : This filter requires a context as second parameter.');
            }
            if (!context.dataset) {
                return null;
            }
            if (!angular.isObject(fieldValue)) {
                console.log('ERROR : This field is not an file field.');
            }
            var url = context.domainUrl;
            url += '/api/datasets/1.0/'+context.dataset.datasetid+'/files/'+fieldValue.id+'/';
            return url;
        };
    });

    mod.filter('thumbnailUrl', ['imageUrlFilter', function(imageUrlFilter) {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:thumbnailUrl
         *
         * @function
         * @param {Object} fieldValue A record field of type file
         * @param {DatasetContext|CatalogContext} context The context from which the record is extracted
         * @return {string} A url pointing to a thumbnail of the file.
         */
        return function(fieldValue, context) {
            var url = imageUrlFilter(fieldValue, context);
            if (url) {
                return url + '300/';
            } else {
                return null;
            }
        };
    }]);

    mod.filter('firstValue', function() {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:firstValue
         *
         * @function
         * @param {Array} array An array of anything
         * @return {String|Number|Boolean|Array|Object} If the input value is an array, returns the first of its 
         * values, otherwise return the value itself.
         */
        return function(value) {
            if (angular.isArray(value)) {
                return value.length > 0 ? value[0] : null;
            } else {
                return value;
            }
        };
    });

    mod.filter('split', function() {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:split
         *
         * @function
         * @param {string} arrayAsString  A string representing an array of values
         * @param {string} [separator] The separator (default: `';'`)
         * @return {Array} An array containing all strings generated by the String.split method.
         */
        return function(list, separator) {
            if (!list) {
                return list;
            }
            if (!separator) {
                separator = ';';
            }
            var values = list.split(separator);
            return values;
        };
    });

    mod.filter('join', function() {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:join
         *
         * @function
         * @param {string[]} values  A list of strings
         * @param {string} [separator] The separator (default: `', '`)
         * @return {string} All strings joined with the given separator.
         */
        return function(value, separator) {
            if (!value) {
                return value;
            }
            if (!separator) {
                separator = ', ';
            }
            if (angular.isArray(value)) {
                return value.join(separator);
            } else {
                return value;
            }
        };
    });

    mod.filter('stringify', function() {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:stringify
         *
         * @function
         * @param {Object} jsonObject A JSON object
         * @return {string} The stringified version of the input object (generated through JSON.stringify)
         */
        return function(value) {
            if (angular.isObject(value)) {
                return JSON.stringify(value);
            } else {
                return value;
            }
        };
    });

    mod.filter('themeColor', ['ODSWidgetsConfig', function(ODSWidgetsConfig) {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:themeColor
         *
         * @function
         * @param {string} theme A theme's slug (that is, its name normalized, see 
         * {@link ods-widgets.filter:themeSlug themeSlug})
         * @return {string} The hexadecimal color code for this theme, as defined through 
         * {@link ods-widgets.ODSWidgetsConfigProvider ODSWidgetsConfig}'s `theme` setting.
         */
        return function(theme) {
            if (!theme) {
                return '';
            }
            if (ODSWidgetsConfig.themes[theme]) {
                return ODSWidgetsConfig.themes[theme].color;
            } else {
                return '';
            }
        };
    }]);

    mod.filter('isBefore', function() {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:isBefore
         * 
         * @function
         * @param {string|Date|Number|Array|Moment} date1 A date
         * @param {string|Date|Number|Array|Moment} date2 Another date, which doesn't need to be in the same format as 
         * date1.
         * @return {Boolean} Whether date1 is strictly before date2 or not, down to the millisecond.
         */
        return function(date1, date2) {
            return moment(date1).isBefore(date2);
        };
    });

    mod.filter('isAfter', function() {
        /**
         * @ngdoc filter
         * @name ods-widgets.filter:isAfter
         * 
         * @function
         * @param {string|Date|Number|Array|Moment} date1 A date
         * @param {string|Date|Number|Array|Moment} date2 Another date, which doesn't need to be in the same format as 
         * date1.
         * @return {Boolean} Whether date1 is strictly after date2 or not, down to the millisecond.
         */
        return function(date1, date2) {
            return moment(date1).isAfter(date2);
        };
    });

    mod.filter('propagateAppendedURLParameters', ['ODSWidgetsConfig', function(ODSWidgetsConfig) {
        return function(url) {
            if (!url) {
                return url;
            }
            if (url.startsWith('http://') || url.startsWith('https://')) {
                // Don't propagate to external links
                return url;
            }

            if (!ODSWidgetsConfig.appendedURLQuerystring) {
                return url;
            }

            if (url.indexOf('?') > -1) {
                url += '&';
            } else {
                url += '?';
            }
            url += ODSWidgetsConfig.appendedURLQuerystring;
            return url;
        };
    }]);

}());