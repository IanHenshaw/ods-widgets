/**
 * @ngdoc module
 * @name gettext
 * @packageName angular-gettext
 * @description Super simple Gettext for Angular.JS
 *
 * A sample application can be found at https://github.com/rubenv/angular-gettext-example.
 * This is an adaptation of the [TodoMVC](http://todomvc.com/) example. You can use this as a guideline while adding {@link angular-gettext angular-gettext} to your own application.
 */
/**
 * @ngdoc factory
 * @module gettext
 * @name gettextPlurals
 * @param {String} [langCode=en] language code
 * @param {Number} [n=0] number to calculate form for
 * @returns {Number} plural form number
 * @description Provides correct plural form id for the given language
 *
 * Example
 * ```js
 * gettextPlurals('ru', 10); // 1
 * gettextPlurals('en', 1);  // 0
 * gettextPlurals();         // 1
 * ```
 */
angular.module('gettext', []);
/**
 * @ngdoc object
 * @module gettext
 * @name gettext
 * @kind function
 * @param {String} str annotation key
 * @description Gettext constant function for annotating strings
 *
 * ```js
 * angular.module('myApp', ['gettext']).config(function(gettext) {
 *   /// MyApp document title
 *   gettext('my-app.title');
 *   ...
 * })
 * ```
 */
angular.module('gettext').constant('gettext', function (str) {
    /*
     * Does nothing, simply returns the input string.
     *
     * This function serves as a marker for `grunt-angular-gettext` to know that
     * this string should be extracted for translations.
     */
    return str;
});

angular.module('gettext').service('translate', ["gettextCatalog", function (gettextCatalog) {
    return function(input) {
        return gettextCatalog.getString(input);
    }
}]);


/**
 * @ngdoc service
 * @module gettext
 * @name gettextCatalog
 * @requires gettextPlurals
 * @requires gettextFallbackLanguage
 * @requires https://docs.angularjs.org/api/ng/service/$http $http
 * @requires https://docs.angularjs.org/api/ng/service/$cacheFactory $cacheFactory
 * @requires https://docs.angularjs.org/api/ng/service/$interpolate $interpolate
 * @requires https://docs.angularjs.org/api/ng/service/$rootScope $rootScope
 * @description Provides set of method to translate stings
 */
angular.module('gettext').factory('gettextCatalog', ["gettextPlurals", "gettextFallbackLanguage", "$http", "$cacheFactory", "$interpolate", "$rootScope", function (gettextPlurals, gettextFallbackLanguage, $http, $cacheFactory, $interpolate, $rootScope) {
    var catalog;
    var noContext = '$$noContext';

    // IE8 returns UPPER CASE tags, even though the source is lower case.
    // This can causes the (key) string in the DOM to have a different case to
    // the string in the `po` files.
    // IE9, IE10 and IE11 reorders the attributes of tags.
    var test = '<span id="test" title="test" class="tested">test</span>';
    var isHTMLModified = (angular.element('<span>' + test + '</span>').html() !== test);

    var prefixDebug = function (string) {
        if (catalog.debug && catalog.currentLanguage !== catalog.baseLanguage) {
            return catalog.debugPrefix + string;
        } else {
            return string;
        }
    };

    var addTranslatedMarkers = function (string) {
        if (catalog.showTranslatedMarkers) {
            return catalog.translatedMarkerPrefix + string + catalog.translatedMarkerSuffix;
        } else {
            return string;
        }
    };

    function broadcastUpdated() {
        /**
         * @ngdoc event
         * @name gettextCatalog#gettextLanguageChanged
         * @eventType broadcast on $rootScope
         * @description Fires language change notification without any additional parameters.
         */
        $rootScope.$broadcast('gettextLanguageChanged');
    }

    catalog = {
        /**
         * @ngdoc property
         * @name gettextCatalog#debug
         * @public
         * @type {Boolean} false
         * @see gettextCatalog#debug
         * @description Whether or not to prefix untranslated strings with `[MISSING]:` or a custom prefix.
         */
        debug: false,
        /**
         * @ngdoc property
         * @name gettextCatalog#debugPrefix
         * @public
         * @type {String} [MISSING]:
         * @description Custom prefix for untranslated strings when {@link gettextCatalog#debug gettextCatalog#debug} set to `true`.
         */
        debugPrefix: '[MISSING]: ',
        /**
         * @ngdoc property
         * @name gettextCatalog#showTranslatedMarkers
         * @public
         * @type {Boolean} false
         * @description Whether or not to wrap all processed text with markers.
         *
         * Example output: `[Welcome]`
         */
        showTranslatedMarkers: false,
        /**
         * @ngdoc property
         * @name gettextCatalog#translatedMarkerPrefix
         * @public
         * @type {String} [
         * @description Custom prefix to mark strings that have been run through {@link angular-gettext angular-gettext}.
         */
        translatedMarkerPrefix: '[',
        /**
         * @ngdoc property
         * @name gettextCatalog#translatedMarkerSuffix
         * @public
         * @type {String} ]
         * @description Custom suffix to mark strings that have been run through {@link angular-gettext angular-gettext}.
         */
        translatedMarkerSuffix: ']',
        /**
         * @ngdoc property
         * @name gettextCatalog#strings
         * @private
         * @type {Object}
         * @description An object of loaded translation strings. Shouldn't be used directly.
         */
        strings: {},
        /**
         * @ngdoc property
         * @name gettextCatalog#baseLanguage
         * @protected
         * @deprecated
         * @since 2.0
         * @type {String} en
         * @description The default language, in which you're application is written.
         *
         * This defaults to English and it's generally a bad idea to use anything else:
         * if your language has different pluralization rules you'll end up with incorrect translations.
         */
        baseLanguage: 'en',
        /**
         * @ngdoc property
         * @name gettextCatalog#currentLanguage
         * @public
         * @type {String}
         * @description Active language.
         */
        currentLanguage: 'en',
        /**
         * @ngdoc property
         * @name gettextCatalog#cache
         * @public
         * @type {String} en
         * @description Language cache for lazy load
         */
        cache: $cacheFactory('strings'),

        /**
         * @ngdoc method
         * @name gettextCatalog#setCurrentLanguage
         * @public
         * @param {String} lang language name
         * @description Sets the current language and makes sure that all translations get updated correctly.
         */
        setCurrentLanguage: function (lang) {
            this.currentLanguage = lang;
            broadcastUpdated();
        },

        /**
         * @ngdoc method
         * @name gettextCatalog#getCurrentLanguage
         * @public
         * @returns {String} current language
         * @description Returns the current language.
         */
        getCurrentLanguage: function () {
            return this.currentLanguage;
        },

        /**
         * @ngdoc method
         * @name gettextCatalog#setStrings
         * @public
         * @param {String} language language name
         * @param {Object.<String>} strings set of strings where the key is the translation `key` and `value` is the translated text
         * @description Processes an object of string definitions. {@link guide:manual-setstrings More details here}.
         */
        setStrings: function (language, strings) {
            if (!this.strings[language]) {
                this.strings[language] = {};
            }

            for (var key in strings) {
                var val = strings[key];

                if (isHTMLModified) {
                    // Use the DOM engine to render any HTML in the key (#131).
                    key = angular.element('<span>' + key + '</span>').html();
                }

                if (angular.isString(val) || angular.isArray(val)) {
                    // No context, wrap it in $$noContext.
                    var obj = {};
                    obj[noContext] = val;
                    val = obj;
                }

                // Expand single strings for each context.
                for (var context in val) {
                    var str = val[context];
                    val[context] = angular.isArray(str) ? str : [str];
                }
                this.strings[language][key] = val;
            }

            broadcastUpdated();
        },

        /**
         * @ngdoc method
         * @name gettextCatalog#getStringFormFor
         * @protected
         * @param {String} language language name
         * @param {String} string translation key
         * @param {Number=} n number to build sting form for
         * @param {String=} context translation key context, e.g. {@link doc:context Verb, Noun}
         * @returns {String|Null} translated or annotated string or null if language is not set
         * @description Translate a string with the given language, count and context.
         */
        getStringFormFor: function (language, string, n, context) {
            if (!language) {
                return null;
            }
            var stringTable = this.strings[language] || {};
            var contexts = stringTable[string] || {};
            var plurals = contexts[context || noContext] || [];
            return plurals[gettextPlurals(language, n)];
        },

        /**
         * @ngdoc method
         * @name gettextCatalog#getString
         * @public
         * @param {String} string translation key
         * @param {$rootScope.Scope=} scope scope to do interpolation against
         * @param {String=} context translation key context, e.g. {@link doc:context Verb, Noun}
         * @returns {String} translated or annotated string
         * @description Translate a string with the given scope and context.
         *
         * First it tries {@link gettextCatalog#currentLanguage gettextCatalog#currentLanguage} (e.g. `en-US`) then {@link gettextFallbackLanguage fallback} (e.g. `en`).
         *
         * When `scope` is supplied it uses Angular.JS interpolation, so something like this will do what you expect:
         * ```js
         * var hello = gettextCatalog.getString("Hello {{name}}!", { name: "Ruben" });
         * // var hello will be "Hallo Ruben!" in Dutch.
         * ```
         * Avoid using scopes - this skips interpolation and is a lot faster.
         */
        getString: function (string, scope, context) {
            var fallbackLanguage = gettextFallbackLanguage(this.currentLanguage);
            string = this.getStringFormFor(this.currentLanguage, string, 1, context) ||
                     this.getStringFormFor(fallbackLanguage, string, 1, context) ||
                     prefixDebug(string);
            string = scope ? $interpolate(string)(scope) : string;
            return addTranslatedMarkers(string);
        },

        /**
         * @ngdoc method
         * @name gettextCatalog#getPlural
         * @public
         * @param {Number} n number to build sting form for
         * @param {String} string translation key
         * @param {String} stringPlural plural translation key
         * @param {$rootScope.Scope=} scope scope to do interpolation against
         * @param {String=} context translation key context, e.g. {@link doc:context Verb, Noun}
         * @returns {String} translated or annotated string
         * @see {@link gettextCatalog#getString gettextCatalog#getString} for details
         * @description Translate a plural string with the given context.
         */
        getPlural: function (n, string, stringPlural, scope, context) {
            var fallbackLanguage = gettextFallbackLanguage(this.currentLanguage);
            string = this.getStringFormFor(this.currentLanguage, string, n, context) ||
                     this.getStringFormFor(fallbackLanguage, string, n, context) ||
                     prefixDebug(n === 1 ? string : stringPlural);
            if (scope) {
                scope.$count = n;
                string = $interpolate(string)(scope);
            }
            return addTranslatedMarkers(string);
        },

        /**
         * @ngdoc method
         * @name gettextCatalog#loadRemote
         * @public
         * @param {String} url location of the translations
         * @description Load a set of translation strings from a given URL.
         *
         * This should be a JSON catalog generated with [angular-gettext-tools](https://github.com/rubenv/angular-gettext-tools).
         * {@link guide:lazy-loading More details here}.
         */
        loadRemote: function (url) {
            return $http({
                method: 'GET',
                url: url,
                cache: catalog.cache
            }).then(function (response) {
                var data = response.data;
                for (var lang in data) {
                    catalog.setStrings(lang, data[lang]);
                }
                return response;
            });
        }
    };

    return catalog;
}]);

/**
 * @ngdoc directive
 * @module gettext
 * @name translate
 * @requires gettextCatalog
 * @requires https://docs.angularjs.org/api/ng/service/$parse $parse
 * @requires https://docs.angularjs.org/api/ng/service/$animate $animate
 * @requires https://docs.angularjs.org/api/ng/service/$compile $compile
 * @requires https://docs.angularjs.org/api/ng/service/$window $window
 * @restrict AE
 * @param {String} [translatePlural] plural form
 * @param {Number} translateN value to watch to substitute correct plural form
 * @param {String} translateContext context value, e.g. {@link doc:context Verb, Noun}
 * @description Annotates and translates text inside directive
 *
 * Full interpolation support is available in translated strings, so the following will work as expected:
 * ```js
 * <div translate>Hello {{name}}!</div>
 * ```
 */
angular.module('gettext').directive('translate', ["gettextCatalog", "$parse", "$animate", "$compile", "$window", function (gettextCatalog, $parse, $animate, $compile, $window) {
    // Trim polyfill for old browsers (instead of jQuery)
    // Based on AngularJS-v1.2.2 (angular.js#620)
    var trim = (function () {
        if (!String.prototype.trim) {
            return function (value) {
                return (typeof value === 'string') ? value.replace(/^\s*/, '').replace(/\s*$/, '') : value;
            };
        }
        return function (value) {
            return (typeof value === 'string') ? value.trim() : value;
        };
    })();

    var compact = (function() {
        return function (value) {
            if (typeof value !== 'string') {
                return value;
            }
            value = trim(value);
            value = value.replace("\n", " ");
            while (value.indexOf("  ") > -1) {
                value = value.replace("  ", " ");
            }
            return value;
        };
    })();

    function assert(condition, missing, found) {
        if (!condition) {
            throw new Error('You should add a ' + missing + ' attribute whenever you add a ' + found + ' attribute.');
        }
    }

    var msie = parseInt((/msie (\d+)/.exec(angular.lowercase($window.navigator.userAgent)) || [])[1], 10);

    return {
        restrict: 'AE',
        // terminal: true,
        compile: function compile(element, attrs) {
            // Validate attributes
            assert(!attrs.translatePlural || attrs.translateN, 'translate-n', 'translate-plural');
            assert(!attrs.translateN || attrs.translatePlural, 'translate-plural', 'translate-n');
            var msgid, attrToTranslate;

            if (attrs.translate) {
                attrToTranslate = attrs.$normalize(attrs.translate)
                msgid = compact(attrs[attrToTranslate]);
            } else {
                msgid = compact(element.html());
            }

            var translatePlural = attrs.translatePlural;
            var translateContext = attrs.translateContext;

            if (msie <= 8) {
                // Workaround fix relating to angular adding a comment node to
                // anchors. angular/angular.js/#1949 / angular/angular.js/#2013
                if (msgid.slice(-13) === '<!--IE fix-->') {
                    msgid = msgid.slice(0, -13);
                }
            }

            return {
                post: function (scope, element, attrs) {
                    var countFn = $parse(attrs.translateN);
                    var pluralScope = null;
                    var linking = true;

                    function update() {
                        // Fetch correct translated string.
                        var translated;
                        if (translatePlural) {
                            scope = pluralScope || (pluralScope = scope.$new());
                            scope.$count = countFn(scope);
                            translated = gettextCatalog.getPlural(scope.$count, msgid, translatePlural, null, translateContext);
                        } else {
                            translated = gettextCatalog.getString(msgid,  null, translateContext);
                        }

                        if (attrs.translate) {
                            if (element.attr(attrs.translate) === translated) {
                                return;
                            }
                            element.attr(attrs.translate, translated);
                        } else {
                            var oldContents = element.contents();

                            if (oldContents.length === 0) {
                                return;
                            }

                            // Avoid redundant swaps
                            if (translated === compact(oldContents.html())) {
                                // Take care of unlinked content
                                if (linking) {
                                    $compile(oldContents)(scope);
                                }
                                return;
                            }

                            // Swap in the translation
                            var newWrapper = angular.element('<span>' + translated + '</span>');
                            $compile(newWrapper.contents())(scope);
                            var newContents = newWrapper.contents();

                            $animate.enter(newContents, element);
                            $animate.leave(oldContents);
                        }
                    }

                    if (attrs.translateN) {
                        scope.$watch(attrs.translateN, update);
                    }

                    /**
                     * @ngdoc event
                     * @name translate#gettextLanguageChanged
                     * @eventType listen on scope
                     * @description Listens for language updates and changes translation accordingly
                     */
                    scope.$on('gettextLanguageChanged', update);

                    update();
                    linking = false;
                }
            };
        }
    };
}]);

/**
 * @ngdoc factory
 * @module gettext
 * @name gettextFallbackLanguage
 * @param {String} langCode language code
 * @returns {String|Null} fallback language
 * @description Strips regional code and returns language code only
 *
 * Example
 * ```js
 * gettextFallbackLanguage('ru');     // "null"
 * gettextFallbackLanguage('en_GB');  // "en"
 * gettextFallbackLanguage();         // null
 * ```
 */
angular.module("gettext").factory("gettextFallbackLanguage", function () {
    var cache = {};
    var pattern = /([^_]+)_[^_]+$/;

    return function (langCode) {
        if (cache[langCode]) {
            return cache[langCode];
        }

        var matches = pattern.exec(langCode);
        if (matches) {
            cache[langCode] = matches[1];
            return matches[1];
        }

        return null;
    };
});
/**
 * @ngdoc filter
 * @module gettext
 * @name translate
 * @requires gettextCatalog
 * @param {String} input translation key
 * @param {String} context context to evaluate key against
 * @returns {String} translated string or annotated key
 * @see {@link doc:context Verb, Noun}
 * @description Takes key and returns string
 *
 * Sometimes it's not an option to use an attribute (e.g. when you want to annotate an attribute value).
 * There's a `translate` filter available for this purpose.
 *
 * ```html
 * <input type="text" placeholder="{{'Username'|translate}}" />
 * ```
 * This filter does not support plural strings.
 *
 * You may want to use {@link guide:custom-annotations custom annotations} to avoid using the `translate` filter all the time. * Is
 */
angular.module('gettext').filter('translate', ["gettextCatalog", function (gettextCatalog) {
    function filter(input, context) {
        return gettextCatalog.getString(input, null, context);
    }
    filter.$stateful = true;
    return filter;
}]);

// Do not edit this file, it is autogenerated using genplurals.py!
angular.module("gettext").factory("gettextPlurals", function () {
    return function (langCode, n) {
        switch (langCode) {
            case "ay":  // Aymará
            case "bo":  // Tibetan
            case "cgg": // Chiga
            case "dz":  // Dzongkha
            case "fa":  // Persian
            case "id":  // Indonesian
            case "ja":  // Japanese
            case "jbo": // Lojban
            case "ka":  // Georgian
            case "kk":  // Kazakh
            case "km":  // Khmer
            case "ko":  // Korean
            case "ky":  // Kyrgyz
            case "lo":  // Lao
            case "ms":  // Malay
            case "my":  // Burmese
            case "sah": // Yakut
            case "su":  // Sundanese
            case "th":  // Thai
            case "tt":  // Tatar
            case "ug":  // Uyghur
            case "vi":  // Vietnamese
            case "wo":  // Wolof
            case "zh":  // Chinese
                // 1 form
                return 0;
            case "is":  // Icelandic
                // 2 forms
                return (n%10!=1 || n%100==11) ? 1 : 0;
            case "jv":  // Javanese
                // 2 forms
                return n!=0 ? 1 : 0;
            case "mk":  // Macedonian
                // 2 forms
                return n==1 || n%10==1 ? 0 : 1;
            case "ach": // Acholi
            case "ak":  // Akan
            case "am":  // Amharic
            case "arn": // Mapudungun
            case "br":  // Breton
            case "fil": // Filipino
            case "fr":  // French
            case "gun": // Gun
            case "ln":  // Lingala
            case "mfe": // Mauritian Creole
            case "mg":  // Malagasy
            case "mi":  // Maori
            case "oc":  // Occitan
            case "pt_BR":  // Brazilian Portuguese
            case "tg":  // Tajik
            case "ti":  // Tigrinya
            case "tr":  // Turkish
            case "uz":  // Uzbek
            case "wa":  // Walloon
            case "zh":  // Chinese
                // 2 forms
                return n>1 ? 1 : 0;
            case "lv":  // Latvian
                // 3 forms
                return (n%10==1 && n%100!=11 ? 0 : n != 0 ? 1 : 2);
            case "lt":  // Lithuanian
                // 3 forms
                return (n%10==1 && n%100!=11 ? 0 : n%10>=2 && (n%100<10 || n%100>=20) ? 1 : 2);
            case "be":  // Belarusian
            case "bs":  // Bosnian
            case "hr":  // Croatian
            case "ru":  // Russian
            case "sr":  // Serbian
            case "uk":  // Ukrainian
                // 3 forms
                return (n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);
            case "mnk": // Mandinka
                // 3 forms
                return (n==0 ? 0 : n==1 ? 1 : 2);
            case "ro":  // Romanian
                // 3 forms
                return (n==1 ? 0 : (n==0 || (n%100 > 0 && n%100 < 20)) ? 1 : 2);
            case "pl":  // Polish
                // 3 forms
                return (n==1 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2);
            case "cs":  // Czech
            case "sk":  // Slovak
                // 3 forms
                return (n==1) ? 0 : (n>=2 && n<=4) ? 1 : 2;
            case "sl":  // Slovenian
                // 4 forms
                return (n%100==1 ? 1 : n%100==2 ? 2 : n%100==3 || n%100==4 ? 3 : 0);
            case "mt":  // Maltese
                // 4 forms
                return (n==1 ? 0 : n==0 || ( n%100>1 && n%100<11) ? 1 : (n%100>10 && n%100<20 ) ? 2 : 3);
            case "gd":  // Scottish Gaelic
                // 4 forms
                return (n==1 || n==11) ? 0 : (n==2 || n==12) ? 1 : (n > 2 && n < 20) ? 2 : 3;
            case "cy":  // Welsh
                // 4 forms
                return (n==1) ? 0 : (n==2) ? 1 : (n != 8 && n != 11) ? 2 : 3;
            case "kw":  // Cornish
                // 4 forms
                return (n==1) ? 0 : (n==2) ? 1 : (n == 3) ? 2 : 3;
            case "ga":  // Irish
                // 5 forms
                return n==1 ? 0 : n==2 ? 1 : n<7 ? 2 : n<11 ? 3 : 4;
            case "ar":  // Arabic
                // 6 forms
                return (n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 ? 4 : 5);
            default: // Everything else
                return n != 1 ? 1 : 0;
        }
    }
});;// Generated by CoffeeScript 1.6.2
/** echo  * @license echo  * while read i do echo  *  done echo
*/


(function() {
  var Color, K, PITHIRD, TWOPI, X, Y, Z, bezier, brewer, chroma, clip_rgb, colors, cos, css2rgb, hex2rgb, hsi2rgb, hsl2rgb, hsv2rgb, lab2lch, lab2rgb, lab_xyz, lch2lab, lch2rgb, limit, luminance, luminance_x, rgb2hex, rgb2hsi, rgb2hsl, rgb2hsv, rgb2lab, rgb2lch, rgb_xyz, root, type, unpack, xyz_lab, xyz_rgb, _ref;

  chroma = function(x, y, z, m) {
    return new Color(x, y, z, m);
  };

  if ((typeof module !== "undefined" && module !== null) && (module.exports != null)) {
    module.exports = chroma;
  }

  if (typeof define === 'function' && define.amd) {
    define([], function() {
      return chroma;
    });
  } else {
    root = typeof exports !== "undefined" && exports !== null ? exports : this;
    root.chroma = chroma;
  }

  chroma.color = function(x, y, z, m) {
    return new Color(x, y, z, m);
  };

  chroma.hsl = function(h, s, l, a) {
    return new Color(h, s, l, a, 'hsl');
  };

  chroma.hsv = function(h, s, v, a) {
    return new Color(h, s, v, a, 'hsv');
  };

  chroma.rgb = function(r, g, b, a) {
    return new Color(r, g, b, a, 'rgb');
  };

  chroma.hex = function(x) {
    return new Color(x);
  };

  chroma.css = function(x) {
    return new Color(x);
  };

  chroma.lab = function(l, a, b) {
    return new Color(l, a, b, 'lab');
  };

  chroma.lch = function(l, c, h) {
    return new Color(l, c, h, 'lch');
  };

  chroma.hsi = function(h, s, i) {
    return new Color(h, s, i, 'hsi');
  };

  chroma.gl = function(r, g, b, a) {
    return new Color(r * 255, g * 255, b * 255, a, 'gl');
  };

  chroma.interpolate = function(a, b, f, m) {
    if ((a == null) || (b == null)) {
      return '#000';
    }
    if (type(a) === 'string') {
      a = new Color(a);
    }
    if (type(b) === 'string') {
      b = new Color(b);
    }
    return a.interpolate(f, b, m);
  };

  chroma.mix = chroma.interpolate;

  chroma.contrast = function(a, b) {
    var l1, l2;

    if (type(a) === 'string') {
      a = new Color(a);
    }
    if (type(b) === 'string') {
      b = new Color(b);
    }
    l1 = a.luminance();
    l2 = b.luminance();
    if (l1 > l2) {
      return (l1 + 0.05) / (l2 + 0.05);
    } else {
      return (l2 + 0.05) / (l1 + 0.05);
    }
  };

  chroma.luminance = function(color) {
    return chroma(color).luminance();
  };

  chroma._Color = Color;

  /**
      chroma.js
  
      Copyright (c) 2011-2013, Gregor Aisch
      All rights reserved.
  
      Redistribution and use in source and binary forms, with or without
      modification, are permitted provided that the following conditions are met:
  
      * Redistributions of source code must retain the above copyright notice, this
        list of conditions and the following disclaimer.
  
      * Redistributions in binary form must reproduce the above copyright notice,
        this list of conditions and the following disclaimer in the documentation
        and/or other materials provided with the distribution.
  
      * The name Gregor Aisch may not be used to endorse or promote products
        derived from this software without specific prior written permission.
  
      THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
      AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
      IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
      DISCLAIMED. IN NO EVENT SHALL GREGOR AISCH OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
      INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
      BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
      DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
      OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
      NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
      EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
  
      @source: https://github.com/gka/chroma.js
  */


  Color = (function() {
    function Color() {
      var a, arg, args, m, me, me_rgb, x, y, z, _i, _len, _ref, _ref1, _ref2, _ref3, _ref4;

      me = this;
      args = [];
      for (_i = 0, _len = arguments.length; _i < _len; _i++) {
        arg = arguments[_i];
        if (arg != null) {
          args.push(arg);
        }
      }
      if (args.length === 0) {
        _ref = [255, 0, 255, 1, 'rgb'], x = _ref[0], y = _ref[1], z = _ref[2], a = _ref[3], m = _ref[4];
      } else if (type(args[0]) === "array") {
        if (args[0].length === 3) {
          _ref1 = args[0], x = _ref1[0], y = _ref1[1], z = _ref1[2];
          a = 1;
        } else if (args[0].length === 4) {
          _ref2 = args[0], x = _ref2[0], y = _ref2[1], z = _ref2[2], a = _ref2[3];
        } else {
          throw 'unknown input argument';
        }
        m = (_ref3 = args[1]) != null ? _ref3 : 'rgb';
      } else if (type(args[0]) === "string") {
        x = args[0];
        m = 'hex';
      } else if (type(args[0]) === "object") {
        _ref4 = args[0]._rgb, x = _ref4[0], y = _ref4[1], z = _ref4[2], a = _ref4[3];
        m = 'rgb';
      } else if (args.length >= 3) {
        x = args[0];
        y = args[1];
        z = args[2];
      }
      if (args.length === 3) {
        m = 'rgb';
        a = 1;
      } else if (args.length === 4) {
        if (type(args[3]) === "string") {
          m = args[3];
          a = 1;
        } else if (type(args[3]) === "number") {
          m = 'rgb';
          a = args[3];
        }
      } else if (args.length === 5) {
        a = args[3];
        m = args[4];
      }
      if (a == null) {
        a = 1;
      }
      if (m === 'rgb') {
        me._rgb = [x, y, z, a];
      } else if (m === 'gl') {
        me._rgb = [x * 255, y * 255, z * 255, a];
      } else if (m === 'hsl') {
        me._rgb = hsl2rgb(x, y, z);
        me._rgb[3] = a;
      } else if (m === 'hsv') {
        me._rgb = hsv2rgb(x, y, z);
        me._rgb[3] = a;
      } else if (m === 'hex') {
        me._rgb = hex2rgb(x);
      } else if (m === 'lab') {
        me._rgb = lab2rgb(x, y, z);
        me._rgb[3] = a;
      } else if (m === 'lch') {
        me._rgb = lch2rgb(x, y, z);
        me._rgb[3] = a;
      } else if (m === 'hsi') {
        me._rgb = hsi2rgb(x, y, z);
        me._rgb[3] = a;
      }
      me_rgb = clip_rgb(me._rgb);
    }

    Color.prototype.rgb = function() {
      return this._rgb.slice(0, 3);
    };

    Color.prototype.rgba = function() {
      return this._rgb;
    };

    Color.prototype.hex = function() {
      return rgb2hex(this._rgb);
    };

    Color.prototype.toString = function() {
      return this.name();
    };

    Color.prototype.hsl = function() {
      return rgb2hsl(this._rgb);
    };

    Color.prototype.hsv = function() {
      return rgb2hsv(this._rgb);
    };

    Color.prototype.lab = function() {
      return rgb2lab(this._rgb);
    };

    Color.prototype.lch = function() {
      return rgb2lch(this._rgb);
    };

    Color.prototype.hsi = function() {
      return rgb2hsi(this._rgb);
    };

    Color.prototype.gl = function() {
      return [this._rgb[0] / 255, this._rgb[1] / 255, this._rgb[2] / 255, this._rgb[3]];
    };

    Color.prototype.luminance = function() {
      return luminance(this._rgb);
    };

    Color.prototype.name = function() {
      var h, k;

      h = this.hex();
      for (k in chroma.colors) {
        if (h === chroma.colors[k]) {
          return k;
        }
      }
      return h;
    };

    Color.prototype.alpha = function(alpha) {
      if (arguments.length) {
        this._rgb[3] = alpha;
        return this;
      }
      return this._rgb[3];
    };

    Color.prototype.css = function(mode) {
      var hsl, me, rgb, rnd;

      if (mode == null) {
        mode = 'rgb';
      }
      me = this;
      rgb = me._rgb;
      if (mode.length === 3 && rgb[3] < 1) {
        mode += 'a';
      }
      if (mode === 'rgb') {
        return mode + '(' + rgb.slice(0, 3).map(Math.round).join(',') + ')';
      } else if (mode === 'rgba') {
        return mode + '(' + rgb.slice(0, 3).map(Math.round).join(',') + ',' + rgb[3] + ')';
      } else if (mode === 'hsl' || mode === 'hsla') {
        hsl = me.hsl();
        rnd = function(a) {
          return Math.round(a * 100) / 100;
        };
        hsl[0] = rnd(hsl[0]);
        hsl[1] = rnd(hsl[1] * 100) + '%';
        hsl[2] = rnd(hsl[2] * 100) + '%';
        if (mode.length === 4) {
          hsl[3] = rgb[3];
        }
        return mode + '(' + hsl.join(',') + ')';
      }
    };

    Color.prototype.interpolate = function(f, col, m) {
      /*
      interpolates between colors
      f = 0 --> me
      f = 1 --> col
      */

      var dh, hue, hue0, hue1, lbv, lbv0, lbv1, me, res, sat, sat0, sat1, xyz0, xyz1;

      me = this;
      if (m == null) {
        m = 'rgb';
      }
      if (type(col) === "string") {
        col = new Color(col);
      }
      if (m === 'hsl' || m === 'hsv' || m === 'lch' || m === 'hsi') {
        if (m === 'hsl') {
          xyz0 = me.hsl();
          xyz1 = col.hsl();
        } else if (m === 'hsv') {
          xyz0 = me.hsv();
          xyz1 = col.hsv();
        } else if (m === 'hsi') {
          xyz0 = me.hsi();
          xyz1 = col.hsi();
        } else if (m === 'lch') {
          xyz0 = me.lch();
          xyz1 = col.lch();
        }
        if (m.substr(0, 1) === 'h') {
          hue0 = xyz0[0], sat0 = xyz0[1], lbv0 = xyz0[2];
          hue1 = xyz1[0], sat1 = xyz1[1], lbv1 = xyz1[2];
        } else {
          lbv0 = xyz0[0], sat0 = xyz0[1], hue0 = xyz0[2];
          lbv1 = xyz1[0], sat1 = xyz1[1], hue1 = xyz1[2];
        }
        if (!isNaN(hue0) && !isNaN(hue1)) {
          if (hue1 > hue0 && hue1 - hue0 > 180) {
            dh = hue1 - (hue0 + 360);
          } else if (hue1 < hue0 && hue0 - hue1 > 180) {
            dh = hue1 + 360 - hue0;
          } else {
            dh = hue1 - hue0;
          }
          hue = hue0 + f * dh;
        } else if (!isNaN(hue0)) {
          hue = hue0;
          if ((lbv1 === 1 || lbv1 === 0) && m !== 'hsv') {
            sat = sat0;
          }
        } else if (!isNaN(hue1)) {
          hue = hue1;
          if ((lbv0 === 1 || lbv0 === 0) && m !== 'hsv') {
            sat = sat1;
          }
        } else {
          hue = Number.NaN;
        }
        if (sat == null) {
          sat = sat0 + f * (sat1 - sat0);
        }
        lbv = lbv0 + f * (lbv1 - lbv0);
        if (m.substr(0, 1) === 'h') {
          res = new Color(hue, sat, lbv, m);
        } else {
          res = new Color(lbv, sat, hue, m);
        }
      } else if (m === 'rgb') {
        xyz0 = me._rgb;
        xyz1 = col._rgb;
        res = new Color(xyz0[0] + f * (xyz1[0] - xyz0[0]), xyz0[1] + f * (xyz1[1] - xyz0[1]), xyz0[2] + f * (xyz1[2] - xyz0[2]), m);
      } else if (m === 'lab') {
        xyz0 = me.lab();
        xyz1 = col.lab();
        res = new Color(xyz0[0] + f * (xyz1[0] - xyz0[0]), xyz0[1] + f * (xyz1[1] - xyz0[1]), xyz0[2] + f * (xyz1[2] - xyz0[2]), m);
      } else {
        throw "color mode " + m + " is not supported";
      }
      res.alpha(me.alpha() + f * (col.alpha() - me.alpha()));
      return res;
    };

    Color.prototype.premultiply = function() {
      var a, rgb;

      rgb = this.rgb();
      a = this.alpha();
      return chroma(rgb[0] * a, rgb[1] * a, rgb[2] * a, a);
    };

    Color.prototype.darken = function(amount) {
      var lch, me;

      if (amount == null) {
        amount = 20;
      }
      me = this;
      lch = me.lch();
      lch[0] -= amount;
      return chroma.lch(lch).alpha(me.alpha());
    };

    Color.prototype.darker = function(amount) {
      return this.darken(amount);
    };

    Color.prototype.brighten = function(amount) {
      if (amount == null) {
        amount = 20;
      }
      return this.darken(-amount);
    };

    Color.prototype.brighter = function(amount) {
      return this.brighten(amount);
    };

    Color.prototype.saturate = function(amount) {
      var lch, me;

      if (amount == null) {
        amount = 20;
      }
      me = this;
      lch = me.lch();
      lch[1] += amount;
      return chroma.lch(lch).alpha(me.alpha());
    };

    Color.prototype.desaturate = function(amount) {
      if (amount == null) {
        amount = 20;
      }
      return this.saturate(-amount);
    };

    return Color;

  })();

  clip_rgb = function(rgb) {
    var i;

    for (i in rgb) {
      if (i < 3) {
        if (rgb[i] < 0) {
          rgb[i] = 0;
        }
        if (rgb[i] > 255) {
          rgb[i] = 255;
        }
      } else if (i === 3) {
        if (rgb[i] < 0) {
          rgb[i] = 0;
        }
        if (rgb[i] > 1) {
          rgb[i] = 1;
        }
      }
    }
    return rgb;
  };

  css2rgb = function(css) {
    var hsl, i, m, rgb, _i, _j, _k, _l;

    css = css.toLowerCase();
    if ((chroma.colors != null) && chroma.colors[css]) {
      return hex2rgb(chroma.colors[css]);
    }
    if (m = css.match(/rgb\(\s*(\-?\d+),\s*(\-?\d+)\s*,\s*(\-?\d+)\s*\)/)) {
      rgb = m.slice(1, 4);
      for (i = _i = 0; _i <= 2; i = ++_i) {
        rgb[i] = +rgb[i];
      }
      rgb[3] = 1;
    } else if (m = css.match(/rgba\(\s*(\-?\d+),\s*(\-?\d+)\s*,\s*(\-?\d+)\s*,\s*([01]|[01]?\.\d+)\)/)) {
      rgb = m.slice(1, 5);
      for (i = _j = 0; _j <= 3; i = ++_j) {
        rgb[i] = +rgb[i];
      }
    } else if (m = css.match(/rgb\(\s*(\-?\d+(?:\.\d+)?)%,\s*(\-?\d+(?:\.\d+)?)%\s*,\s*(\-?\d+(?:\.\d+)?)%\s*\)/)) {
      rgb = m.slice(1, 4);
      for (i = _k = 0; _k <= 2; i = ++_k) {
        rgb[i] = Math.round(rgb[i] * 2.55);
      }
      rgb[3] = 1;
    } else if (m = css.match(/rgba\(\s*(\-?\d+(?:\.\d+)?)%,\s*(\-?\d+(?:\.\d+)?)%\s*,\s*(\-?\d+(?:\.\d+)?)%\s*,\s*([01]|[01]?\.\d+)\)/)) {
      rgb = m.slice(1, 5);
      for (i = _l = 0; _l <= 2; i = ++_l) {
        rgb[i] = Math.round(rgb[i] * 2.55);
      }
      rgb[3] = +rgb[3];
    } else if (m = css.match(/hsl\(\s*(\-?\d+(?:\.\d+)?),\s*(\-?\d+(?:\.\d+)?)%\s*,\s*(\-?\d+(?:\.\d+)?)%\s*\)/)) {
      hsl = m.slice(1, 4);
      hsl[1] *= 0.01;
      hsl[2] *= 0.01;
      rgb = hsl2rgb(hsl);
      rgb[3] = 1;
    } else if (m = css.match(/hsla\(\s*(\-?\d+(?:\.\d+)?),\s*(\-?\d+(?:\.\d+)?)%\s*,\s*(\-?\d+(?:\.\d+)?)%\s*,\s*([01]|[01]?\.\d+)\)/)) {
      hsl = m.slice(1, 4);
      hsl[1] *= 0.01;
      hsl[2] *= 0.01;
      rgb = hsl2rgb(hsl);
      rgb[3] = +m[4];
    }
    return rgb;
  };

  hex2rgb = function(hex) {
    var a, b, g, r, rgb, u;

    if (hex.match(/^#?([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/)) {
      if (hex.length === 4 || hex.length === 7) {
        hex = hex.substr(1);
      }
      if (hex.length === 3) {
        hex = hex.split("");
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      u = parseInt(hex, 16);
      r = u >> 16;
      g = u >> 8 & 0xFF;
      b = u & 0xFF;
      return [r, g, b, 1];
    }
    if (hex.match(/^#?([A-Fa-f0-9]{8})$/)) {
      if (hex.length === 9) {
        hex = hex.substr(1);
      }
      u = parseInt(hex, 16);
      r = u >> 24 & 0xFF;
      g = u >> 16 & 0xFF;
      b = u >> 8 & 0xFF;
      a = u & 0xFF;
      return [r, g, b, a];
    }
    if (rgb = css2rgb(hex)) {
      return rgb;
    }
    throw "unknown color: " + hex;
  };

  hsi2rgb = function(h, s, i) {
    /*
    borrowed from here:
    http://hummer.stanford.edu/museinfo/doc/examples/humdrum/keyscape2/hsi2rgb.cpp
    */

    var b, g, r, _ref;

    _ref = unpack(arguments), h = _ref[0], s = _ref[1], i = _ref[2];
    h /= 360;
    if (h < 1 / 3) {
      b = (1 - s) / 3;
      r = (1 + s * cos(TWOPI * h) / cos(PITHIRD - TWOPI * h)) / 3;
      g = 1 - (b + r);
    } else if (h < 2 / 3) {
      h -= 1 / 3;
      r = (1 - s) / 3;
      g = (1 + s * cos(TWOPI * h) / cos(PITHIRD - TWOPI * h)) / 3;
      b = 1 - (r + g);
    } else {
      h -= 2 / 3;
      g = (1 - s) / 3;
      b = (1 + s * cos(TWOPI * h) / cos(PITHIRD - TWOPI * h)) / 3;
      r = 1 - (g + b);
    }
    r = limit(i * r * 3);
    g = limit(i * g * 3);
    b = limit(i * b * 3);
    return [r * 255, g * 255, b * 255];
  };

  hsl2rgb = function() {
    var b, c, g, h, i, l, r, s, t1, t2, t3, _i, _ref, _ref1;

    _ref = unpack(arguments), h = _ref[0], s = _ref[1], l = _ref[2];
    if (s === 0) {
      r = g = b = l * 255;
    } else {
      t3 = [0, 0, 0];
      c = [0, 0, 0];
      t2 = l < 0.5 ? l * (1 + s) : l + s - l * s;
      t1 = 2 * l - t2;
      h /= 360;
      t3[0] = h + 1 / 3;
      t3[1] = h;
      t3[2] = h - 1 / 3;
      for (i = _i = 0; _i <= 2; i = ++_i) {
        if (t3[i] < 0) {
          t3[i] += 1;
        }
        if (t3[i] > 1) {
          t3[i] -= 1;
        }
        if (6 * t3[i] < 1) {
          c[i] = t1 + (t2 - t1) * 6 * t3[i];
        } else if (2 * t3[i] < 1) {
          c[i] = t2;
        } else if (3 * t3[i] < 2) {
          c[i] = t1 + (t2 - t1) * ((2 / 3) - t3[i]) * 6;
        } else {
          c[i] = t1;
        }
      }
      _ref1 = [Math.round(c[0] * 255), Math.round(c[1] * 255), Math.round(c[2] * 255)], r = _ref1[0], g = _ref1[1], b = _ref1[2];
    }
    return [r, g, b];
  };

  hsv2rgb = function() {
    var b, f, g, h, i, p, q, r, s, t, v, _ref, _ref1, _ref2, _ref3, _ref4, _ref5, _ref6;

    _ref = unpack(arguments), h = _ref[0], s = _ref[1], v = _ref[2];
    v *= 255;
    if (s === 0) {
      r = g = b = v;
    } else {
      if (h === 360) {
        h = 0;
      }
      if (h > 360) {
        h -= 360;
      }
      if (h < 0) {
        h += 360;
      }
      h /= 60;
      i = Math.floor(h);
      f = h - i;
      p = v * (1 - s);
      q = v * (1 - s * f);
      t = v * (1 - s * (1 - f));
      switch (i) {
        case 0:
          _ref1 = [v, t, p], r = _ref1[0], g = _ref1[1], b = _ref1[2];
          break;
        case 1:
          _ref2 = [q, v, p], r = _ref2[0], g = _ref2[1], b = _ref2[2];
          break;
        case 2:
          _ref3 = [p, v, t], r = _ref3[0], g = _ref3[1], b = _ref3[2];
          break;
        case 3:
          _ref4 = [p, q, v], r = _ref4[0], g = _ref4[1], b = _ref4[2];
          break;
        case 4:
          _ref5 = [t, p, v], r = _ref5[0], g = _ref5[1], b = _ref5[2];
          break;
        case 5:
          _ref6 = [v, p, q], r = _ref6[0], g = _ref6[1], b = _ref6[2];
      }
    }
    r = Math.round(r);
    g = Math.round(g);
    b = Math.round(b);
    return [r, g, b];
  };

  K = 18;

  X = 0.950470;

  Y = 1;

  Z = 1.088830;

  lab2lch = function() {
    var a, b, c, h, l, _ref;

    _ref = unpack(arguments), l = _ref[0], a = _ref[1], b = _ref[2];
    c = Math.sqrt(a * a + b * b);
    h = Math.atan2(b, a) / Math.PI * 180;
    return [l, c, h];
  };

  lab2rgb = function(l, a, b) {
    /*
    adapted to match d3 implementation
    */

    var g, r, x, y, z, _ref, _ref1;

    if (l !== void 0 && l.length === 3) {
      _ref = l, l = _ref[0], a = _ref[1], b = _ref[2];
    }
    if (l !== void 0 && l.length === 3) {
      _ref1 = l, l = _ref1[0], a = _ref1[1], b = _ref1[2];
    }
    y = (l + 16) / 116;
    x = y + a / 500;
    z = y - b / 200;
    x = lab_xyz(x) * X;
    y = lab_xyz(y) * Y;
    z = lab_xyz(z) * Z;
    r = xyz_rgb(3.2404542 * x - 1.5371385 * y - 0.4985314 * z);
    g = xyz_rgb(-0.9692660 * x + 1.8760108 * y + 0.0415560 * z);
    b = xyz_rgb(0.0556434 * x - 0.2040259 * y + 1.0572252 * z);
    return [limit(r, 0, 255), limit(g, 0, 255), limit(b, 0, 255), 1];
  };

  lab_xyz = function(x) {
    if (x > 0.206893034) {
      return x * x * x;
    } else {
      return (x - 4 / 29) / 7.787037;
    }
  };

  xyz_rgb = function(r) {
    return Math.round(255 * (r <= 0.00304 ? 12.92 * r : 1.055 * Math.pow(r, 1 / 2.4) - 0.055));
  };

  lch2lab = function() {
    /*
    Convert from a qualitative parameter h and a quantitative parameter l to a 24-bit pixel. These formulas were invented by David Dalrymple to obtain maximum contrast without going out of gamut if the parameters are in the range 0-1.
    A saturation multiplier was added by Gregor Aisch
    */

    var c, h, l, _ref;

    _ref = unpack(arguments), l = _ref[0], c = _ref[1], h = _ref[2];
    h = h * Math.PI / 180;
    return [l, Math.cos(h) * c, Math.sin(h) * c];
  };

  lch2rgb = function(l, c, h) {
    var L, a, b, g, r, _ref, _ref1;

    _ref = lch2lab(l, c, h), L = _ref[0], a = _ref[1], b = _ref[2];
    _ref1 = lab2rgb(L, a, b), r = _ref1[0], g = _ref1[1], b = _ref1[2];
    return [limit(r, 0, 255), limit(g, 0, 255), limit(b, 0, 255)];
  };

  luminance = function(r, g, b) {
    var _ref;

    _ref = unpack(arguments), r = _ref[0], g = _ref[1], b = _ref[2];
    r = luminance_x(r);
    g = luminance_x(g);
    b = luminance_x(b);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  luminance_x = function(x) {
    x /= 255;
    if (x <= 0.03928) {
      return x / 12.92;
    } else {
      return Math.pow((x + 0.055) / 1.055, 2.4);
    }
  };

  rgb2hex = function() {
    var b, g, r, str, u, _ref;

    _ref = unpack(arguments), r = _ref[0], g = _ref[1], b = _ref[2];
    u = r << 16 | g << 8 | b;
    str = "000000" + u.toString(16);
    return "#" + str.substr(str.length - 6);
  };

  rgb2hsi = function() {
    /*
    borrowed from here:
    http://hummer.stanford.edu/museinfo/doc/examples/humdrum/keyscape2/rgb2hsi.cpp
    */

    var TWOPI, b, g, h, i, min, r, s, _ref;

    _ref = unpack(arguments), r = _ref[0], g = _ref[1], b = _ref[2];
    TWOPI = Math.PI * 2;
    r /= 255;
    g /= 255;
    b /= 255;
    min = Math.min(r, g, b);
    i = (r + g + b) / 3;
    s = 1 - min / i;
    if (s === 0) {
      h = 0;
    } else {
      h = ((r - g) + (r - b)) / 2;
      h /= Math.sqrt((r - g) * (r - g) + (r - b) * (g - b));
      h = Math.acos(h);
      if (b > g) {
        h = TWOPI - h;
      }
      h /= TWOPI;
    }
    return [h * 360, s, i];
  };

  rgb2hsl = function(r, g, b) {
    var h, l, max, min, s, _ref;

    if (r !== void 0 && r.length >= 3) {
      _ref = r, r = _ref[0], g = _ref[1], b = _ref[2];
    }
    r /= 255;
    g /= 255;
    b /= 255;
    min = Math.min(r, g, b);
    max = Math.max(r, g, b);
    l = (max + min) / 2;
    if (max === min) {
      s = 0;
      h = Number.NaN;
    } else {
      s = l < 0.5 ? (max - min) / (max + min) : (max - min) / (2 - max - min);
    }
    if (r === max) {
      h = (g - b) / (max - min);
    } else if (g === max) {
      h = 2 + (b - r) / (max - min);
    } else if (b === max) {
      h = 4 + (r - g) / (max - min);
    }
    h *= 60;
    if (h < 0) {
      h += 360;
    }
    return [h, s, l];
  };

  rgb2hsv = function() {
    var b, delta, g, h, max, min, r, s, v, _ref;

    _ref = unpack(arguments), r = _ref[0], g = _ref[1], b = _ref[2];
    min = Math.min(r, g, b);
    max = Math.max(r, g, b);
    delta = max - min;
    v = max / 255.0;
    if (max === 0) {
      h = Number.NaN;
      s = 0;
    } else {
      s = delta / max;
      if (r === max) {
        h = (g - b) / delta;
      }
      if (g === max) {
        h = 2 + (b - r) / delta;
      }
      if (b === max) {
        h = 4 + (r - g) / delta;
      }
      h *= 60;
      if (h < 0) {
        h += 360;
      }
    }
    return [h, s, v];
  };

  rgb2lab = function() {
    var b, g, r, x, y, z, _ref;

    _ref = unpack(arguments), r = _ref[0], g = _ref[1], b = _ref[2];
    r = rgb_xyz(r);
    g = rgb_xyz(g);
    b = rgb_xyz(b);
    x = xyz_lab((0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / X);
    y = xyz_lab((0.2126729 * r + 0.7151522 * g + 0.0721750 * b) / Y);
    z = xyz_lab((0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / Z);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };

  rgb_xyz = function(r) {
    if ((r /= 255) <= 0.04045) {
      return r / 12.92;
    } else {
      return Math.pow((r + 0.055) / 1.055, 2.4);
    }
  };

  xyz_lab = function(x) {
    if (x > 0.008856) {
      return Math.pow(x, 1 / 3);
    } else {
      return 7.787037 * x + 4 / 29;
    }
  };

  rgb2lch = function() {
    var a, b, g, l, r, _ref, _ref1;

    _ref = unpack(arguments), r = _ref[0], g = _ref[1], b = _ref[2];
    _ref1 = rgb2lab(r, g, b), l = _ref1[0], a = _ref1[1], b = _ref1[2];
    return lab2lch(l, a, b);
  };

  /*
      chroma.js
  
      Copyright (c) 2011-2013, Gregor Aisch
      All rights reserved.
  
      Redistribution and use in source and binary forms, with or without
      modification, are permitted provided that the following conditions are met:
  
      * Redistributions of source code must retain the above copyright notice, this
        list of conditions and the following disclaimer.
  
      * Redistributions in binary form must reproduce the above copyright notice,
        this list of conditions and the following disclaimer in the documentation
        and/or other materials provided with the distribution.
  
      * The name Gregor Aisch may not be used to endorse or promote products
        derived from this software without specific prior written permission.
  
      THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
      AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
      IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
      DISCLAIMED. IN NO EVENT SHALL GREGOR AISCH OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
      INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
      BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
      DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
      OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
      NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
      EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
  
      @source: https://github.com/gka/chroma.js
  */


  chroma.scale = function(colors, positions) {
    var classifyValue, f, getClass, getColor, resetCache, setColors, setDomain, tmap, _colorCache, _colors, _correctLightness, _domain, _fixed, _max, _min, _mode, _nacol, _numClasses, _out, _pos, _spread;

    _mode = 'rgb';
    _nacol = chroma('#ccc');
    _spread = 0;
    _fixed = false;
    _domain = [0, 1];
    _colors = [];
    _out = false;
    _pos = [];
    _min = 0;
    _max = 1;
    _correctLightness = false;
    _numClasses = 0;
    _colorCache = {};
    setColors = function(colors, positions) {
      var c, col, _i, _j, _ref, _ref1, _ref2;

      if (colors == null) {
        colors = ['#ddd', '#222'];
      }
      if ((colors != null) && type(colors) === 'string' && (((_ref = chroma.brewer) != null ? _ref[colors] : void 0) != null)) {
        colors = chroma.brewer[colors];
      }
      if (type(colors) === 'array') {
        colors = colors.slice(0);
        for (c = _i = 0, _ref1 = colors.length - 1; 0 <= _ref1 ? _i <= _ref1 : _i >= _ref1; c = 0 <= _ref1 ? ++_i : --_i) {
          col = colors[c];
          if (type(col) === "string") {
            colors[c] = chroma(col);
          }
        }
        if (positions != null) {
          _pos = positions;
        } else {
          _pos = [];
          for (c = _j = 0, _ref2 = colors.length - 1; 0 <= _ref2 ? _j <= _ref2 : _j >= _ref2; c = 0 <= _ref2 ? ++_j : --_j) {
            _pos.push(c / (colors.length - 1));
          }
        }
      }
      resetCache();
      return _colors = colors;
    };
    setDomain = function(domain) {
      if (domain == null) {
        domain = [];
      }
      /*
      # use this if you want to display a limited number of data classes
      # possible methods are "equalinterval", "quantiles", "custom"
      */

      _domain = domain;
      _min = domain[0];
      _max = domain[domain.length - 1];
      resetCache();
      if (domain.length === 2) {
        return _numClasses = 0;
      } else {
        return _numClasses = domain.length - 1;
      }
    };
    getClass = function(value) {
      var i, n;

      if (_domain != null) {
        n = _domain.length - 1;
        i = 0;
        while (i < n && value >= _domain[i]) {
          i++;
        }
        return i - 1;
      }
      return 0;
    };
    tmap = function(t) {
      return t;
    };
    classifyValue = function(value) {
      var i, maxc, minc, n, val;

      val = value;
      if (_domain.length > 2) {
        n = _domain.length - 1;
        i = getClass(value);
        minc = _domain[0] + (_domain[1] - _domain[0]) * (0 + _spread * 0.5);
        maxc = _domain[n - 1] + (_domain[n] - _domain[n - 1]) * (1 - _spread * 0.5);
        val = _min + ((_domain[i] + (_domain[i + 1] - _domain[i]) * 0.5 - minc) / (maxc - minc)) * (_max - _min);
      }
      return val;
    };
    getColor = function(val, bypassMap) {
      var c, col, f0, i, k, p, t, _i, _ref;

      if (bypassMap == null) {
        bypassMap = false;
      }
      if (isNaN(val)) {
        return _nacol;
      }
      if (!bypassMap) {
        if (_domain.length > 2) {
          c = getClass(val);
          t = c / (_numClasses - 1);
        } else {
          // fix https://github.com/gka/chroma.js/issues/37
          if (_max !== _min) {
            t = f0 = (val - _min) / (_max - _min);
            t = Math.min(1, Math.max(0, t));
          } else {
            t = _min;
          }
        }
      } else {
        t = val;
      }
      if (!bypassMap) {
        t = tmap(t);
      }
      k = Math.floor(t * 10000);
      if (_colorCache[k]) {
        col = _colorCache[k];
      } else {
        if (type(_colors) === 'array') {
          for (i = _i = 0, _ref = _pos.length - 1; 0 <= _ref ? _i <= _ref : _i >= _ref; i = 0 <= _ref ? ++_i : --_i) {
            p = _pos[i];
            if (t <= p) {
              col = _colors[i];
              break;
            }
            if (t >= p && i === _pos.length - 1) {
              col = _colors[i];
              break;
            }
            if (t > p && t < _pos[i + 1]) {
              t = (t - p) / (_pos[i + 1] - p);
              col = chroma.interpolate(_colors[i], _colors[i + 1], t, _mode);
              break;
            }
          }
        } else if (type(_colors) === 'function') {
          col = _colors(t);
        }
        _colorCache[k] = col;
      }
      return col;
    };
    resetCache = function() {
      return _colorCache = {};
    };
    setColors(colors, positions);
    f = function(v) {
      var c;

      c = getColor(v);
      if (_out && c[_out]) {
        return c[_out]();
      } else {
        return c;
      }
    };
    f.domain = function(domain, classes, mode, key) {
      var d;

      if (mode == null) {
        mode = 'e';
      }
      if (!arguments.length) {
        return _domain;
      }
      if (classes != null) {
        d = chroma.analyze(domain, key);
        if (classes === 0) {
          domain = [d.min, d.max];
        } else {
          domain = chroma.limits(d, mode, classes);
        }
      }
      setDomain(domain);
      return f;
    };
    f.mode = function(_m) {
      if (!arguments.length) {
        return _mode;
      }
      _mode = _m;
      resetCache();
      return f;
    };
    f.range = function(colors, _pos) {
      setColors(colors, _pos);
      return f;
    };
    f.out = function(_o) {
      _out = _o;
      return f;
    };
    f.spread = function(val) {
      if (!arguments.length) {
        return _spread;
      }
      _spread = val;
      return f;
    };
    f.correctLightness = function(v) {
      if (!arguments.length) {
        return _correctLightness;
      }
      _correctLightness = v;
      resetCache();
      if (_correctLightness) {
        tmap = function(t) {
          var L0, L1, L_actual, L_diff, L_ideal, max_iter, pol, t0, t1;

          L0 = getColor(0, true).lab()[0];
          L1 = getColor(1, true).lab()[0];
          pol = L0 > L1;
          L_actual = getColor(t, true).lab()[0];
          L_ideal = L0 + (L1 - L0) * t;
          L_diff = L_actual - L_ideal;
          t0 = 0;
          t1 = 1;
          max_iter = 20;
          while (Math.abs(L_diff) > 1e-2 && max_iter-- > 0) {
            (function() {
              if (pol) {
                L_diff *= -1;
              }
              if (L_diff < 0) {
                t0 = t;
                t += (t1 - t) * 0.5;
              } else {
                t1 = t;
                t += (t0 - t) * 0.5;
              }
              L_actual = getColor(t, true).lab()[0];
              return L_diff = L_actual - L_ideal;
            })();
          }
          return t;
        };
      } else {
        tmap = function(t) {
          return t;
        };
      }
      return f;
    };
    f.colors = function(out) {
      var i, samples, _i, _j, _len, _ref;

      if (out == null) {
        out = 'hex';
      }
      colors = [];
      samples = [];
      if (_domain.length > 2) {
        for (i = _i = 1, _ref = _domain.length; 1 <= _ref ? _i < _ref : _i > _ref; i = 1 <= _ref ? ++_i : --_i) {
          samples.push((_domain[i - 1] + _domain[i]) * 0.5);
        }
      } else {
        samples = _domain;
      }
      for (_j = 0, _len = samples.length; _j < _len; _j++) {
        i = samples[_j];
        colors.push(f(i)[out]());
      }
      return colors;
    };
    return f;
  };

  if ((_ref = chroma.scales) == null) {
    chroma.scales = {};
  }

  chroma.scales.cool = function() {
    return chroma.scale([chroma.hsl(180, 1, .9), chroma.hsl(250, .7, .4)]);
  };

  chroma.scales.hot = function() {
    return chroma.scale(['#000', '#f00', '#ff0', '#fff'], [0, .25, .75, 1]).mode('rgb');
  };

  /*
      chroma.js
  
      Copyright (c) 2011-2013, Gregor Aisch
      All rights reserved.
  
      Redistribution and use in source and binary forms, with or without
      modification, are permitted provided that the following conditions are met:
  
      * Redistributions of source code must retain the above copyright notice, this
        list of conditions and the following disclaimer.
  
      * Redistributions in binary form must reproduce the above copyright notice,
        this list of conditions and the following disclaimer in the documentation
        and/or other materials provided with the distribution.
  
      * The name Gregor Aisch may not be used to endorse or promote products
        derived from this software without specific prior written permission.
  
      THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
      AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
      IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
      DISCLAIMED. IN NO EVENT SHALL GREGOR AISCH OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
      INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
      BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
      DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
      OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
      NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
      EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
  
      @source: https://github.com/gka/chroma.js
  */


  chroma.analyze = function(data, key, filter) {
    var add, k, r, val, visit, _i, _len;

    r = {
      min: Number.MAX_VALUE,
      max: Number.MAX_VALUE * -1,
      sum: 0,
      values: [],
      count: 0
    };
    if (filter == null) {
      filter = function() {
        return true;
      };
    }
    add = function(val) {
      if ((val != null) && !isNaN(val)) {
        r.values.push(val);
        r.sum += val;
        if (val < r.min) {
          r.min = val;
        }
        if (val > r.max) {
          r.max = val;
        }
        r.count += 1;
      }
    };
    visit = function(val, k) {
      if (filter(val, k)) {
        if ((key != null) && type(key) === 'function') {
          return add(key(val));
        } else if ((key != null) && type(key) === 'string' || type(key) === 'number') {
          return add(val[key]);
        } else {
          return add(val);
        }
      }
    };
    if (type(data) === 'array') {
      for (_i = 0, _len = data.length; _i < _len; _i++) {
        val = data[_i];
        visit(val);
      }
    } else {
      for (k in data) {
        val = data[k];
        visit(val, k);
      }
    }
    r.domain = [r.min, r.max];
    r.limits = function(mode, num) {
      return chroma.limits(r, mode, num);
    };
    return r;
  };

  chroma.limits = function(data, mode, num) {
    var assignments, best, centroids, cluster, clusterSizes, dist, i, j, kClusters, limits, max, max_log, min, min_log, mindist, n, nb_iters, newCentroids, p, pb, pr, repeat, sum, tmpKMeansBreaks, value, values, _i, _j, _k, _l, _m, _n, _o, _p, _q, _r, _ref1, _ref10, _ref11, _ref12, _ref13, _ref14, _ref15, _ref2, _ref3, _ref4, _ref5, _ref6, _ref7, _ref8, _ref9, _s, _t, _u, _v, _w;

    if (mode == null) {
      mode = 'equal';
    }
    if (num == null) {
      num = 7;
    }
    if (type(data) === 'array') {
      data = chroma.analyze(data);
    }
    min = data.min;
    max = data.max;
    sum = data.sum;
    values = data.values.sort(function(a, b) {
      return a - b;
    });
    limits = [];
    if (mode.substr(0, 1) === 'c') {
      limits.push(min);
      limits.push(max);
    }
    if (mode.substr(0, 1) === 'e') {
      limits.push(min);
      for (i = _i = 1, _ref1 = num - 1; 1 <= _ref1 ? _i <= _ref1 : _i >= _ref1; i = 1 <= _ref1 ? ++_i : --_i) {
        limits.push(min + (i / num) * (max - min));
      }
      limits.push(max);
    } else if (mode.substr(0, 1) === 'l') {
      if (min <= 0) {
        throw 'Logarithmic scales are only possible for values > 0';
      }
      min_log = Math.LOG10E * Math.log(min);
      max_log = Math.LOG10E * Math.log(max);
      limits.push(min);
      for (i = _j = 1, _ref2 = num - 1; 1 <= _ref2 ? _j <= _ref2 : _j >= _ref2; i = 1 <= _ref2 ? ++_j : --_j) {
        limits.push(Math.pow(10, min_log + (i / num) * (max_log - min_log)));
      }
      limits.push(max);
    } else if (mode.substr(0, 1) === 'q') {
      limits.push(min);
      for (i = _k = 1, _ref3 = num - 1; 1 <= _ref3 ? _k <= _ref3 : _k >= _ref3; i = 1 <= _ref3 ? ++_k : --_k) {
        p = values.length * i / num;
        pb = Math.floor(p);
        if (pb === p) {
          limits.push(values[pb]);
        } else {
          pr = p - pb;
          limits.push(values[pb] * pr + values[pb + 1] * (1 - pr));
        }
      }
      limits.push(max);
    } else if (mode.substr(0, 1) === 'k') {
      /*
      implementation based on
      http://code.google.com/p/figue/source/browse/trunk/figue.js#336
      simplified for 1-d input values
      */

      n = values.length;
      assignments = new Array(n);
      clusterSizes = new Array(num);
      repeat = true;
      nb_iters = 0;
      centroids = null;
      centroids = [];
      centroids.push(min);
      for (i = _l = 1, _ref4 = num - 1; 1 <= _ref4 ? _l <= _ref4 : _l >= _ref4; i = 1 <= _ref4 ? ++_l : --_l) {
        centroids.push(min + (i / num) * (max - min));
      }
      centroids.push(max);
      while (repeat) {
        for (j = _m = 0, _ref5 = num - 1; 0 <= _ref5 ? _m <= _ref5 : _m >= _ref5; j = 0 <= _ref5 ? ++_m : --_m) {
          clusterSizes[j] = 0;
        }
        for (i = _n = 0, _ref6 = n - 1; 0 <= _ref6 ? _n <= _ref6 : _n >= _ref6; i = 0 <= _ref6 ? ++_n : --_n) {
          value = values[i];
          mindist = Number.MAX_VALUE;
          for (j = _o = 0, _ref7 = num - 1; 0 <= _ref7 ? _o <= _ref7 : _o >= _ref7; j = 0 <= _ref7 ? ++_o : --_o) {
            dist = Math.abs(centroids[j] - value);
            if (dist < mindist) {
              mindist = dist;
              best = j;
            }
          }
          clusterSizes[best]++;
          assignments[i] = best;
        }
        newCentroids = new Array(num);
        for (j = _p = 0, _ref8 = num - 1; 0 <= _ref8 ? _p <= _ref8 : _p >= _ref8; j = 0 <= _ref8 ? ++_p : --_p) {
          newCentroids[j] = null;
        }
        for (i = _q = 0, _ref9 = n - 1; 0 <= _ref9 ? _q <= _ref9 : _q >= _ref9; i = 0 <= _ref9 ? ++_q : --_q) {
          cluster = assignments[i];
          if (newCentroids[cluster] === null) {
            newCentroids[cluster] = values[i];
          } else {
            newCentroids[cluster] += values[i];
          }
        }
        for (j = _r = 0, _ref10 = num - 1; 0 <= _ref10 ? _r <= _ref10 : _r >= _ref10; j = 0 <= _ref10 ? ++_r : --_r) {
          newCentroids[j] *= 1 / clusterSizes[j];
        }
        repeat = false;
        for (j = _s = 0, _ref11 = num - 1; 0 <= _ref11 ? _s <= _ref11 : _s >= _ref11; j = 0 <= _ref11 ? ++_s : --_s) {
          if (newCentroids[j] !== centroids[i]) {
            repeat = true;
            break;
          }
        }
        centroids = newCentroids;
        nb_iters++;
        if (nb_iters > 200) {
          repeat = false;
        }
      }
      kClusters = {};
      for (j = _t = 0, _ref12 = num - 1; 0 <= _ref12 ? _t <= _ref12 : _t >= _ref12; j = 0 <= _ref12 ? ++_t : --_t) {
        kClusters[j] = [];
      }
      for (i = _u = 0, _ref13 = n - 1; 0 <= _ref13 ? _u <= _ref13 : _u >= _ref13; i = 0 <= _ref13 ? ++_u : --_u) {
        cluster = assignments[i];
        kClusters[cluster].push(values[i]);
      }
      tmpKMeansBreaks = [];
      for (j = _v = 0, _ref14 = num - 1; 0 <= _ref14 ? _v <= _ref14 : _v >= _ref14; j = 0 <= _ref14 ? ++_v : --_v) {
        tmpKMeansBreaks.push(kClusters[j][0]);
        tmpKMeansBreaks.push(kClusters[j][kClusters[j].length - 1]);
      }
      tmpKMeansBreaks = tmpKMeansBreaks.sort(function(a, b) {
        return a - b;
      });
      limits.push(tmpKMeansBreaks[0]);
      for (i = _w = 1, _ref15 = tmpKMeansBreaks.length - 1; _w <= _ref15; i = _w += 2) {
        if (!isNaN(tmpKMeansBreaks[i])) {
          limits.push(tmpKMeansBreaks[i]);
        }
      }
    }
    return limits;
  };

  /**
    ColorBrewer colors for chroma.js
  
    Copyright (c) 2002 Cynthia Brewer, Mark Harrower, and The 
    Pennsylvania State University.
  
    Licensed under the Apache License, Version 2.0 (the "License"); 
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at 
    http://www.apache.org/licenses/LICENSE-2.0
  
    Unless required by applicable law or agreed to in writing, software distributed
    under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
    CONDITIONS OF ANY KIND, either express or implied. See the License for the
    specific language governing permissions and limitations under the License.
  
      @preserve
  */


  chroma.brewer = brewer = {
    OrRd: ['#fff7ec', '#fee8c8', '#fdd49e', '#fdbb84', '#fc8d59', '#ef6548', '#d7301f', '#b30000', '#7f0000'],
    PuBu: ['#fff7fb', '#ece7f2', '#d0d1e6', '#a6bddb', '#74a9cf', '#3690c0', '#0570b0', '#045a8d', '#023858'],
    BuPu: ['#f7fcfd', '#e0ecf4', '#bfd3e6', '#9ebcda', '#8c96c6', '#8c6bb1', '#88419d', '#810f7c', '#4d004b'],
    Oranges: ['#fff5eb', '#fee6ce', '#fdd0a2', '#fdae6b', '#fd8d3c', '#f16913', '#d94801', '#a63603', '#7f2704'],
    BuGn: ['#f7fcfd', '#e5f5f9', '#ccece6', '#99d8c9', '#66c2a4', '#41ae76', '#238b45', '#006d2c', '#00441b'],
    YlOrBr: ['#ffffe5', '#fff7bc', '#fee391', '#fec44f', '#fe9929', '#ec7014', '#cc4c02', '#993404', '#662506'],
    YlGn: ['#ffffe5', '#f7fcb9', '#d9f0a3', '#addd8e', '#78c679', '#41ab5d', '#238443', '#006837', '#004529'],
    Reds: ['#fff5f0', '#fee0d2', '#fcbba1', '#fc9272', '#fb6a4a', '#ef3b2c', '#cb181d', '#a50f15', '#67000d'],
    RdPu: ['#fff7f3', '#fde0dd', '#fcc5c0', '#fa9fb5', '#f768a1', '#dd3497', '#ae017e', '#7a0177', '#49006a'],
    Greens: ['#f7fcf5', '#e5f5e0', '#c7e9c0', '#a1d99b', '#74c476', '#41ab5d', '#238b45', '#006d2c', '#00441b'],
    YlGnBu: ['#ffffd9', '#edf8b1', '#c7e9b4', '#7fcdbb', '#41b6c4', '#1d91c0', '#225ea8', '#253494', '#081d58'],
    Purples: ['#fcfbfd', '#efedf5', '#dadaeb', '#bcbddc', '#9e9ac8', '#807dba', '#6a51a3', '#54278f', '#3f007d'],
    GnBu: ['#f7fcf0', '#e0f3db', '#ccebc5', '#a8ddb5', '#7bccc4', '#4eb3d3', '#2b8cbe', '#0868ac', '#084081'],
    Greys: ['#ffffff', '#f0f0f0', '#d9d9d9', '#bdbdbd', '#969696', '#737373', '#525252', '#252525', '#000000'],
    YlOrRd: ['#ffffcc', '#ffeda0', '#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c', '#bd0026', '#800026'],
    PuRd: ['#f7f4f9', '#e7e1ef', '#d4b9da', '#c994c7', '#df65b0', '#e7298a', '#ce1256', '#980043', '#67001f'],
    Blues: ['#f7fbff', '#deebf7', '#c6dbef', '#9ecae1', '#6baed6', '#4292c6', '#2171b5', '#08519c', '#08306b'],
    PuBuGn: ['#fff7fb', '#ece2f0', '#d0d1e6', '#a6bddb', '#67a9cf', '#3690c0', '#02818a', '#016c59', '#014636'],
    Spectral: ['#9e0142', '#d53e4f', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#e6f598', '#abdda4', '#66c2a5', '#3288bd', '#5e4fa2'],
    RdYlGn: ['#a50026', '#d73027', '#f46d43', '#fdae61', '#fee08b', '#ffffbf', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850', '#006837'],
    RdBu: ['#67001f', '#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#f7f7f7', '#d1e5f0', '#92c5de', '#4393c3', '#2166ac', '#053061'],
    PiYG: ['#8e0152', '#c51b7d', '#de77ae', '#f1b6da', '#fde0ef', '#f7f7f7', '#e6f5d0', '#b8e186', '#7fbc41', '#4d9221', '#276419'],
    PRGn: ['#40004b', '#762a83', '#9970ab', '#c2a5cf', '#e7d4e8', '#f7f7f7', '#d9f0d3', '#a6dba0', '#5aae61', '#1b7837', '#00441b'],
    RdYlBu: ['#a50026', '#d73027', '#f46d43', '#fdae61', '#fee090', '#ffffbf', '#e0f3f8', '#abd9e9', '#74add1', '#4575b4', '#313695'],
    BrBG: ['#543005', '#8c510a', '#bf812d', '#dfc27d', '#f6e8c3', '#f5f5f5', '#c7eae5', '#80cdc1', '#35978f', '#01665e', '#003c30'],
    RdGy: ['#67001f', '#b2182b', '#d6604d', '#f4a582', '#fddbc7', '#ffffff', '#e0e0e0', '#bababa', '#878787', '#4d4d4d', '#1a1a1a'],
    PuOr: ['#7f3b08', '#b35806', '#e08214', '#fdb863', '#fee0b6', '#f7f7f7', '#d8daeb', '#b2abd2', '#8073ac', '#542788', '#2d004b'],
    Set2: ['#66c2a5', '#fc8d62', '#8da0cb', '#e78ac3', '#a6d854', '#ffd92f', '#e5c494', '#b3b3b3'],
    Accent: ['#7fc97f', '#beaed4', '#fdc086', '#ffff99', '#386cb0', '#f0027f', '#bf5b17', '#666666'],
    Set1: ['#e41a1c', '#377eb8', '#4daf4a', '#984ea3', '#ff7f00', '#ffff33', '#a65628', '#f781bf', '#999999'],
    Set3: ['#8dd3c7', '#ffffb3', '#bebada', '#fb8072', '#80b1d3', '#fdb462', '#b3de69', '#fccde5', '#d9d9d9', '#bc80bd', '#ccebc5', '#ffed6f'],
    Dark2: ['#1b9e77', '#d95f02', '#7570b3', '#e7298a', '#66a61e', '#e6ab02', '#a6761d', '#666666'],
    Paired: ['#a6cee3', '#1f78b4', '#b2df8a', '#33a02c', '#fb9a99', '#e31a1c', '#fdbf6f', '#ff7f00', '#cab2d6', '#6a3d9a', '#ffff99', '#b15928'],
    Pastel2: ['#b3e2cd', '#fdcdac', '#cbd5e8', '#f4cae4', '#e6f5c9', '#fff2ae', '#f1e2cc', '#cccccc'],
    Pastel1: ['#fbb4ae', '#b3cde3', '#ccebc5', '#decbe4', '#fed9a6', '#ffffcc', '#e5d8bd', '#fddaec', '#f2f2f2']
  };



  /**
    X11 color names
  
    http://www.w3.org/TR/css3-color/#svg-color
  */


  chroma.colors = colors = {
    indigo: "#4b0082",
    gold: "#ffd700",
    hotpink: "#ff69b4",
    firebrick: "#b22222",
    indianred: "#cd5c5c",
    yellow: "#ffff00",
    mistyrose: "#ffe4e1",
    darkolivegreen: "#556b2f",
    olive: "#808000",
    darkseagreen: "#8fbc8f",
    pink: "#ffc0cb",
    tomato: "#ff6347",
    lightcoral: "#f08080",
    orangered: "#ff4500",
    navajowhite: "#ffdead",
    lime: "#00ff00",
    palegreen: "#98fb98",
    darkslategrey: "#2f4f4f",
    greenyellow: "#adff2f",
    burlywood: "#deb887",
    seashell: "#fff5ee",
    mediumspringgreen: "#00fa9a",
    fuchsia: "#ff00ff",
    papayawhip: "#ffefd5",
    blanchedalmond: "#ffebcd",
    chartreuse: "#7fff00",
    dimgray: "#696969",
    black: "#000000",
    peachpuff: "#ffdab9",
    springgreen: "#00ff7f",
    aquamarine: "#7fffd4",
    white: "#ffffff",
    orange: "#ffa500",
    lightsalmon: "#ffa07a",
    darkslategray: "#2f4f4f",
    brown: "#a52a2a",
    ivory: "#fffff0",
    dodgerblue: "#1e90ff",
    peru: "#cd853f",
    lawngreen: "#7cfc00",
    chocolate: "#d2691e",
    crimson: "#dc143c",
    forestgreen: "#228b22",
    darkgrey: "#a9a9a9",
    lightseagreen: "#20b2aa",
    cyan: "#00ffff",
    mintcream: "#f5fffa",
    silver: "#c0c0c0",
    antiquewhite: "#faebd7",
    mediumorchid: "#ba55d3",
    skyblue: "#87ceeb",
    gray: "#808080",
    darkturquoise: "#00ced1",
    goldenrod: "#daa520",
    darkgreen: "#006400",
    floralwhite: "#fffaf0",
    darkviolet: "#9400d3",
    darkgray: "#a9a9a9",
    moccasin: "#ffe4b5",
    saddlebrown: "#8b4513",
    grey: "#808080",
    darkslateblue: "#483d8b",
    lightskyblue: "#87cefa",
    lightpink: "#ffb6c1",
    mediumvioletred: "#c71585",
    slategrey: "#708090",
    red: "#ff0000",
    deeppink: "#ff1493",
    limegreen: "#32cd32",
    darkmagenta: "#8b008b",
    palegoldenrod: "#eee8aa",
    plum: "#dda0dd",
    turquoise: "#40e0d0",
    lightgrey: "#d3d3d3",
    lightgoldenrodyellow: "#fafad2",
    darkgoldenrod: "#b8860b",
    lavender: "#e6e6fa",
    maroon: "#800000",
    yellowgreen: "#9acd32",
    sandybrown: "#f4a460",
    thistle: "#d8bfd8",
    violet: "#ee82ee",
    navy: "#000080",
    magenta: "#ff00ff",
    dimgrey: "#696969",
    tan: "#d2b48c",
    rosybrown: "#bc8f8f",
    olivedrab: "#6b8e23",
    blue: "#0000ff",
    lightblue: "#add8e6",
    ghostwhite: "#f8f8ff",
    honeydew: "#f0fff0",
    cornflowerblue: "#6495ed",
    slateblue: "#6a5acd",
    linen: "#faf0e6",
    darkblue: "#00008b",
    powderblue: "#b0e0e6",
    seagreen: "#2e8b57",
    darkkhaki: "#bdb76b",
    snow: "#fffafa",
    sienna: "#a0522d",
    mediumblue: "#0000cd",
    royalblue: "#4169e1",
    lightcyan: "#e0ffff",
    green: "#008000",
    mediumpurple: "#9370db",
    midnightblue: "#191970",
    cornsilk: "#fff8dc",
    paleturquoise: "#afeeee",
    bisque: "#ffe4c4",
    slategray: "#708090",
    darkcyan: "#008b8b",
    khaki: "#f0e68c",
    wheat: "#f5deb3",
    teal: "#008080",
    darkorchid: "#9932cc",
    deepskyblue: "#00bfff",
    salmon: "#fa8072",
    darkred: "#8b0000",
    steelblue: "#4682b4",
    palevioletred: "#db7093",
    lightslategray: "#778899",
    aliceblue: "#f0f8ff",
    lightslategrey: "#778899",
    lightgreen: "#90ee90",
    orchid: "#da70d6",
    gainsboro: "#dcdcdc",
    mediumseagreen: "#3cb371",
    lightgray: "#d3d3d3",
    mediumturquoise: "#48d1cc",
    lemonchiffon: "#fffacd",
    cadetblue: "#5f9ea0",
    lightyellow: "#ffffe0",
    lavenderblush: "#fff0f5",
    coral: "#ff7f50",
    purple: "#800080",
    aqua: "#00ffff",
    whitesmoke: "#f5f5f5",
    mediumslateblue: "#7b68ee",
    darkorange: "#ff8c00",
    mediumaquamarine: "#66cdaa",
    darksalmon: "#e9967a",
    beige: "#f5f5dc",
    blueviolet: "#8a2be2",
    azure: "#f0ffff",
    lightsteelblue: "#b0c4de",
    oldlace: "#fdf5e6"
  };

  /*
      chroma.js
  
      Copyright (c) 2011-2013, Gregor Aisch
      All rights reserved.
  
      Redistribution and use in source and binary forms, with or without
      modification, are permitted provided that the following conditions are met:
  
      * Redistributions of source code must retain the above copyright notice, this
        list of conditions and the following disclaimer.
  
      * Redistributions in binary form must reproduce the above copyright notice,
        this list of conditions and the following disclaimer in the documentation
        and/or other materials provided with the distribution.
  
      * The name Gregor Aisch may not be used to endorse or promote products
        derived from this software without specific prior written permission.
  
      THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
      AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
      IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
      DISCLAIMED. IN NO EVENT SHALL GREGOR AISCH OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT,
      INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING,
      BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
      DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY
      OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
      NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE,
      EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
  
      @source: https://github.com/gka/chroma.js
  */


  type = (function() {
    /*
    for browser-safe type checking+
    ported from jQuery's $.type
    */

    var classToType, name, _i, _len, _ref1;

    classToType = {};
    _ref1 = "Boolean Number String Function Array Date RegExp Undefined Null".split(" ");
    for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
      name = _ref1[_i];
      classToType["[object " + name + "]"] = name.toLowerCase();
    }
    return function(obj) {
      var strType;

      strType = Object.prototype.toString.call(obj);
      return classToType[strType] || "object";
    };
  })();

  limit = function(x, min, max) {
    if (min == null) {
      min = 0;
    }
    if (max == null) {
      max = 1;
    }
    if (x < min) {
      x = min;
    }
    if (x > max) {
      x = max;
    }
    return x;
  };

  unpack = function(args) {
    if (args.length >= 3) {
      return args;
    } else {
      return args[0];
    }
  };

  TWOPI = Math.PI * 2;

  PITHIRD = Math.PI / 3;

  cos = Math.cos;

  /*
  interpolates between a set of colors uzing a bezier spline
  */


  bezier = function(colors) {
    var I, I0, I1, c, lab0, lab1, lab2, lab3, _ref1, _ref2, _ref3;

    colors = (function() {
      var _i, _len, _results;

      _results = [];
      for (_i = 0, _len = colors.length; _i < _len; _i++) {
        c = colors[_i];
        _results.push(chroma(c));
      }
      return _results;
    })();
    if (colors.length === 2) {
      _ref1 = (function() {
        var _i, _len, _results;

        _results = [];
        for (_i = 0, _len = colors.length; _i < _len; _i++) {
          c = colors[_i];
          _results.push(c.lab());
        }
        return _results;
      })(), lab0 = _ref1[0], lab1 = _ref1[1];
      I = function(t) {
        var i, lab;

        lab = (function() {
          var _i, _results;

          _results = [];
          for (i = _i = 0; _i <= 2; i = ++_i) {
            _results.push(lab0[i] + t * (lab1[i] - lab0[i]));
          }
          return _results;
        })();
        return chroma.lab.apply(chroma, lab);
      };
    } else if (colors.length === 3) {
      _ref2 = (function() {
        var _i, _len, _results;

        _results = [];
        for (_i = 0, _len = colors.length; _i < _len; _i++) {
          c = colors[_i];
          _results.push(c.lab());
        }
        return _results;
      })(), lab0 = _ref2[0], lab1 = _ref2[1], lab2 = _ref2[2];
      I = function(t) {
        var i, lab;

        lab = (function() {
          var _i, _results;

          _results = [];
          for (i = _i = 0; _i <= 2; i = ++_i) {
            _results.push((1 - t) * (1 - t) * lab0[i] + 2 * (1 - t) * t * lab1[i] + t * t * lab2[i]);
          }
          return _results;
        })();
        return chroma.lab.apply(chroma, lab);
      };
    } else if (colors.length === 4) {
      _ref3 = (function() {
        var _i, _len, _results;

        _results = [];
        for (_i = 0, _len = colors.length; _i < _len; _i++) {
          c = colors[_i];
          _results.push(c.lab());
        }
        return _results;
      })(), lab0 = _ref3[0], lab1 = _ref3[1], lab2 = _ref3[2], lab3 = _ref3[3];
      I = function(t) {
        var i, lab;

        lab = (function() {
          var _i, _results;

          _results = [];
          for (i = _i = 0; _i <= 2; i = ++_i) {
            _results.push((1 - t) * (1 - t) * (1 - t) * lab0[i] + 3 * (1 - t) * (1 - t) * t * lab1[i] + 3 * (1 - t) * t * t * lab2[i] + t * t * t * lab3[i]);
          }
          return _results;
        })();
        return chroma.lab.apply(chroma, lab);
      };
    } else if (colors.length === 5) {
      I0 = bezier(colors.slice(0, 3));
      I1 = bezier(colors.slice(2, 5));
      I = function(t) {
        if (t < 0.5) {
          return I0(t * 2);
        } else {
          return I1((t - 0.5) * 2);
        }
      };
    }
    return I;
  };

  chroma.interpolate.bezier = bezier;

}).call(this);
;/*! http://mths.be/jsesc v0.5.0 by @mathias */
;(function(root) {

    /*--------------------------------------------------------------------------*/

    var object = {};
    var hasOwnProperty = object.hasOwnProperty;
    var forOwn = function(object, callback) {
        var key;
        for (key in object) {
            if (hasOwnProperty.call(object, key)) {
                callback(key, object[key]);
            }
        }
    };

    var extend = function(destination, source) {
        if (!source) {
            return destination;
        }
        forOwn(source, function(key, value) {
            destination[key] = value;
        });
        return destination;
    };

    var regexSingleEscape = /["'\\\b\f\n\r\t]/;

    var regexWhitelist = /[ !#-&\(-\[\]-~]/;

    var jsesc = function(argument, options) {
        // Handle options
        var defaults = {
            'es6': false,
            'json': false
        };
        var json = options && options.json;
        options = extend(defaults, options);
        var result;

        var string = argument;
        // Loop over each code unit in the string and escape it
        var index = -1;
        var length = string.length;
        var first;
        var second;
        var codePoint;
        result = '';
        while (++index < length) {
            var character = string.charAt(index);
            if (options.es6) {
                first = string.charCodeAt(index);
                if ( // check if it’s the start of a surrogate pair
                    first >= 0xD800 && first <= 0xDBFF && // high surrogate
                    length > index + 1 // there is a next code unit
                ) {
                    second = string.charCodeAt(index + 1);
                    if (second >= 0xDC00 && second <= 0xDFFF) { // low surrogate
                        // http://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
                        codePoint = (first - 0xD800) * 0x400 + second - 0xDC00 + 0x10000;
                        result += '\\u{' + codePoint.toString(16).toUpperCase() + '}';
                        index++;
                        continue;
                    }
                }
            }
            if (regexWhitelist.test(character)) {
                // It’s a printable ASCII character that is not `"`, `'` or `\`,
                // so don’t escape it.
                result += character;
                continue;
            }
            if (character == '"') {
                result += character;
                continue;
            }
            if (character == '\'') {
                result += character;
                continue;
            }
            if (regexSingleEscape.test(character)) {
                // no need for a `hasOwnProperty` check here
                result += character;
                continue;
            }
            var charCode = character.charCodeAt(0);
            var hexadecimal = charCode.toString(16).toUpperCase();
            var longhand = hexadecimal.length > 2 || json;
            var escaped = '\\' + (longhand ? 'u' : 'x') +
                ('0000' + hexadecimal).slice(longhand ? -4 : -2);
            result += escaped;
            continue;
        }
        return result;
    };

    jsesc.version = '0.5.0';

    root.jsesc = jsesc;

}(this));
;/**
 * This script gives you the zone info key representing your device's time zone setting.
 *
 * @name jsTimezoneDetect
 * @version 1.0.5
 * @author Jon Nylander
 * @license MIT License - http://www.opensource.org/licenses/mit-license.php
 *
 * For usage and examples, visit:
 * http://pellepim.bitbucket.org/jstz/
 *
 * Copyright (c) Jon Nylander
 */

/*jslint undef: true */
/*global console, exports*/

(function(root) {
  /**
   * Namespace to hold all the code for timezone detection.
   */
  var jstz = (function () {
      'use strict';
      var HEMISPHERE_SOUTH = 's',

          /**
           * Gets the offset in minutes from UTC for a certain date.
           * @param {Date} date
           * @returns {Number}
           */
          get_date_offset = function (date) {
              var offset = -date.getTimezoneOffset();
              return (offset !== null ? offset : 0);
          },

          get_date = function (year, month, date) {
              var d = new Date();
              if (year !== undefined) {
                d.setFullYear(year);
              }
              d.setMonth(month);
              d.setDate(date);
              return d;
          },

          get_january_offset = function (year) {
              return get_date_offset(get_date(year, 0 ,2));
          },

          get_june_offset = function (year) {
              return get_date_offset(get_date(year, 5, 2));
          },

          /**
           * Private method.
           * Checks whether a given date is in daylight saving time.
           * If the date supplied is after august, we assume that we're checking
           * for southern hemisphere DST.
           * @param {Date} date
           * @returns {Boolean}
           */
          date_is_dst = function (date) {
              var is_southern = date.getMonth() > 7,
                  base_offset = is_southern ? get_june_offset(date.getFullYear()) :
                                              get_january_offset(date.getFullYear()),
                  date_offset = get_date_offset(date),
                  is_west = base_offset < 0,
                  dst_offset = base_offset - date_offset;

              if (!is_west && !is_southern) {
                  return dst_offset < 0;
              }

              return dst_offset !== 0;
          },

          /**
           * This function does some basic calculations to create information about
           * the user's timezone. It uses REFERENCE_YEAR as a solid year for which
           * the script has been tested rather than depend on the year set by the
           * client device.
           *
           * Returns a key that can be used to do lookups in jstz.olson.timezones.
           * eg: "720,1,2".
           *
           * @returns {String}
           */

          lookup_key = function () {
              var january_offset = get_january_offset(),
                  june_offset = get_june_offset(),
                  diff = january_offset - june_offset;

              if (diff < 0) {
                  return january_offset + ",1";
              } else if (diff > 0) {
                  return june_offset + ",1," + HEMISPHERE_SOUTH;
              }

              return january_offset + ",0";
          },

          /**
           * Uses get_timezone_info() to formulate a key to use in the olson.timezones dictionary.
           *
           * Returns a primitive object on the format:
           * {'timezone': TimeZone, 'key' : 'the key used to find the TimeZone object'}
           *
           * @returns Object
           */
          determine = function () {
              var key = lookup_key();
              return new jstz.TimeZone(jstz.olson.timezones[key]);
          },

          /**
           * This object contains information on when daylight savings starts for
           * different timezones.
           *
           * The list is short for a reason. Often we do not have to be very specific
           * to single out the correct timezone. But when we do, this list comes in
           * handy.
           *
           * Each value is a date denoting when daylight savings starts for that timezone.
           */
          dst_start_for = function (tz_name) {

            var ru_pre_dst_change = new Date(2010, 6, 15, 1, 0, 0, 0), // In 2010 Russia had DST, this allows us to detect Russia :)
                dst_starts = {
                    'America/Denver': new Date(2011, 2, 13, 3, 0, 0, 0),
                    'America/Mazatlan': new Date(2011, 3, 3, 3, 0, 0, 0),
                    'America/Chicago': new Date(2011, 2, 13, 3, 0, 0, 0),
                    'America/Mexico_City': new Date(2011, 3, 3, 3, 0, 0, 0),
                    'America/Asuncion': new Date(2012, 9, 7, 3, 0, 0, 0),
                    'America/Santiago': new Date(2012, 9, 3, 3, 0, 0, 0),
                    'America/Campo_Grande': new Date(2012, 9, 21, 5, 0, 0, 0),
                    'America/Montevideo': new Date(2011, 9, 2, 3, 0, 0, 0),
                    'America/Sao_Paulo': new Date(2011, 9, 16, 5, 0, 0, 0),
                    'America/Los_Angeles': new Date(2011, 2, 13, 8, 0, 0, 0),
                    'America/Santa_Isabel': new Date(2011, 3, 5, 8, 0, 0, 0),
                    'America/Havana': new Date(2012, 2, 10, 2, 0, 0, 0),
                    'America/New_York': new Date(2012, 2, 10, 7, 0, 0, 0),
                    'Europe/Helsinki': new Date(2013, 2, 31, 5, 0, 0, 0),
                    'Pacific/Auckland': new Date(2011, 8, 26, 7, 0, 0, 0),
                    'America/Halifax': new Date(2011, 2, 13, 6, 0, 0, 0),
                    'America/Goose_Bay': new Date(2011, 2, 13, 2, 1, 0, 0),
                    'America/Miquelon': new Date(2011, 2, 13, 5, 0, 0, 0),
                    'America/Godthab': new Date(2011, 2, 27, 1, 0, 0, 0),
                    'Europe/Moscow': ru_pre_dst_change,
                    'Asia/Amman': new Date(2013, 2, 29, 1, 0, 0, 0),
                    'Asia/Beirut': new Date(2013, 2, 31, 2, 0, 0, 0),
                    'Asia/Damascus': new Date(2013, 3, 6, 2, 0, 0, 0),
                    'Asia/Jerusalem': new Date(2013, 2, 29, 5, 0, 0, 0),
                    'Asia/Yekaterinburg': ru_pre_dst_change,
                    'Asia/Omsk': ru_pre_dst_change,
                    'Asia/Krasnoyarsk': ru_pre_dst_change,
                    'Asia/Irkutsk': ru_pre_dst_change,
                    'Asia/Yakutsk': ru_pre_dst_change,
                    'Asia/Vladivostok': ru_pre_dst_change,
                    'Asia/Baku': new Date(2013, 2, 31, 4, 0, 0),
                    'Asia/Yerevan': new Date(2013, 2, 31, 3, 0, 0),
                    'Asia/Kamchatka': ru_pre_dst_change,
                    'Asia/Gaza': new Date(2010, 2, 27, 4, 0, 0),
                    'Africa/Cairo': new Date(2010, 4, 1, 3, 0, 0),
                    'Europe/Minsk': ru_pre_dst_change,
                    'Pacific/Apia': new Date(2010, 10, 1, 1, 0, 0, 0),
                    'Pacific/Fiji': new Date(2010, 11, 1, 0, 0, 0),
                    'Australia/Perth': new Date(2008, 10, 1, 1, 0, 0, 0)
                };

              return dst_starts[tz_name];
          };

      return {
          determine: determine,
          date_is_dst: date_is_dst,
          dst_start_for: dst_start_for
      };
  }());

  /**
   * Simple object to perform ambiguity check and to return name of time zone.
   */
  jstz.TimeZone = function (tz_name) {
      'use strict';
        /**
         * The keys in this object are timezones that we know may be ambiguous after
         * a preliminary scan through the olson_tz object.
         *
         * The array of timezones to compare must be in the order that daylight savings
         * starts for the regions.
         */
      var AMBIGUITIES = {
              'America/Denver':       ['America/Denver', 'America/Mazatlan'],
              'America/Chicago':      ['America/Chicago', 'America/Mexico_City'],
              'America/Santiago':     ['America/Santiago', 'America/Asuncion', 'America/Campo_Grande'],
              'America/Montevideo':   ['America/Montevideo', 'America/Sao_Paulo'],
              'Asia/Beirut':          ['Asia/Amman', 'Asia/Jerusalem', 'Asia/Beirut', 'Europe/Helsinki','Asia/Damascus'],
              'Pacific/Auckland':     ['Pacific/Auckland', 'Pacific/Fiji'],
              'America/Los_Angeles':  ['America/Los_Angeles', 'America/Santa_Isabel'],
              'America/New_York':     ['America/Havana', 'America/New_York'],
              'America/Halifax':      ['America/Goose_Bay', 'America/Halifax'],
              'America/Godthab':      ['America/Miquelon', 'America/Godthab'],
              'Asia/Dubai':           ['Europe/Moscow'],
              'Asia/Dhaka':           ['Asia/Yekaterinburg'],
              'Asia/Jakarta':         ['Asia/Omsk'],
              'Asia/Shanghai':        ['Asia/Krasnoyarsk', 'Australia/Perth'],
              'Asia/Tokyo':           ['Asia/Irkutsk'],
              'Australia/Brisbane':   ['Asia/Yakutsk'],
              'Pacific/Noumea':       ['Asia/Vladivostok'],
              'Pacific/Tarawa':       ['Asia/Kamchatka', 'Pacific/Fiji'],
              'Pacific/Tongatapu':    ['Pacific/Apia'],
              'Asia/Baghdad':         ['Europe/Minsk'],
              'Asia/Baku':            ['Asia/Yerevan','Asia/Baku'],
              'Africa/Johannesburg':  ['Asia/Gaza', 'Africa/Cairo']
          },

          timezone_name = tz_name,

          /**
           * Checks if a timezone has possible ambiguities. I.e timezones that are similar.
           *
           * For example, if the preliminary scan determines that we're in America/Denver.
           * We double check here that we're really there and not in America/Mazatlan.
           *
           * This is done by checking known dates for when daylight savings start for different
           * timezones during 2010 and 2011.
           */
          ambiguity_check = function () {
              var ambiguity_list = AMBIGUITIES[timezone_name],
                  length = ambiguity_list.length,
                  i = 0,
                  tz = ambiguity_list[0];

              for (; i < length; i += 1) {
                  tz = ambiguity_list[i];

                  if (jstz.date_is_dst(jstz.dst_start_for(tz))) {
                      timezone_name = tz;
                      return;
                  }
              }
          },

          /**
           * Checks if it is possible that the timezone is ambiguous.
           */
          is_ambiguous = function () {
              return typeof (AMBIGUITIES[timezone_name]) !== 'undefined';
          };

      if (is_ambiguous()) {
          ambiguity_check();
      }

      return {
          name: function () {
              return timezone_name;
          }
      };
  };

  jstz.olson = {};

  /*
   * The keys in this dictionary are comma separated as such:
   *
   * First the offset compared to UTC time in minutes.
   *
   * Then a flag which is 0 if the timezone does not take daylight savings into account and 1 if it
   * does.
   *
   * Thirdly an optional 's' signifies that the timezone is in the southern hemisphere,
   * only interesting for timezones with DST.
   *
   * The mapped arrays is used for constructing the jstz.TimeZone object from within
   * jstz.determine_timezone();
   */
  jstz.olson.timezones = {
      '-720,0'   : 'Pacific/Majuro',
      '-660,0'   : 'Pacific/Pago_Pago',
      '-600,1'   : 'America/Adak',
      '-600,0'   : 'Pacific/Honolulu',
      '-570,0'   : 'Pacific/Marquesas',
      '-540,0'   : 'Pacific/Gambier',
      '-540,1'   : 'America/Anchorage',
      '-480,1'   : 'America/Los_Angeles',
      '-480,0'   : 'Pacific/Pitcairn',
      '-420,0'   : 'America/Phoenix',
      '-420,1'   : 'America/Denver',
      '-360,0'   : 'America/Guatemala',
      '-360,1'   : 'America/Chicago',
      '-360,1,s' : 'Pacific/Easter',
      '-300,0'   : 'America/Bogota',
      '-300,1'   : 'America/New_York',
      '-270,0'   : 'America/Caracas',
      '-240,1'   : 'America/Halifax',
      '-240,0'   : 'America/Santo_Domingo',
      '-240,1,s' : 'America/Santiago',
      '-210,1'   : 'America/St_Johns',
      '-180,1'   : 'America/Godthab',
      '-180,0'   : 'America/Argentina/Buenos_Aires',
      '-180,1,s' : 'America/Montevideo',
      '-120,0'   : 'America/Noronha',
      '-120,1'   : 'America/Noronha',
      '-60,1'    : 'Atlantic/Azores',
      '-60,0'    : 'Atlantic/Cape_Verde',
      '0,0'      : 'UTC',
      '0,1'      : 'Europe/London',
      '60,1'     : 'Europe/Berlin',
      '60,0'     : 'Africa/Lagos',
      '60,1,s'   : 'Africa/Windhoek',
      '120,1'    : 'Asia/Beirut',
      '120,0'    : 'Africa/Johannesburg',
      '180,0'    : 'Asia/Baghdad',
      '180,1'    : 'Europe/Moscow',
      '210,1'    : 'Asia/Tehran',
      '240,0'    : 'Asia/Dubai',
      '240,1'    : 'Asia/Baku',
      '270,0'    : 'Asia/Kabul',
      '300,1'    : 'Asia/Yekaterinburg',
      '300,0'    : 'Asia/Karachi',
      '330,0'    : 'Asia/Kolkata',
      '345,0'    : 'Asia/Kathmandu',
      '360,0'    : 'Asia/Dhaka',
      '360,1'    : 'Asia/Omsk',
      '390,0'    : 'Asia/Rangoon',
      '420,1'    : 'Asia/Krasnoyarsk',
      '420,0'    : 'Asia/Jakarta',
      '480,0'    : 'Asia/Shanghai',
      '480,1'    : 'Asia/Irkutsk',
      '525,0'    : 'Australia/Eucla',
      '525,1,s'  : 'Australia/Eucla',
      '540,1'    : 'Asia/Yakutsk',
      '540,0'    : 'Asia/Tokyo',
      '570,0'    : 'Australia/Darwin',
      '570,1,s'  : 'Australia/Adelaide',
      '600,0'    : 'Australia/Brisbane',
      '600,1'    : 'Asia/Vladivostok',
      '600,1,s'  : 'Australia/Sydney',
      '630,1,s'  : 'Australia/Lord_Howe',
      '660,1'    : 'Asia/Kamchatka',
      '660,0'    : 'Pacific/Noumea',
      '690,0'    : 'Pacific/Norfolk',
      '720,1,s'  : 'Pacific/Auckland',
      '720,0'    : 'Pacific/Tarawa',
      '765,1,s'  : 'Pacific/Chatham',
      '780,0'    : 'Pacific/Tongatapu',
      '780,1,s'  : 'Pacific/Apia',
      '840,0'    : 'Pacific/Kiritimati'
  };

  if (typeof exports !== 'undefined') {
    exports.jstz = jstz;
  } else {
    root.jstz = jstz;
  }
})(this);;/*jslint browser: true, eqeqeq: true, bitwise: true, newcap: true, immed: true, regexp: false */

/**
LazyLoad makes it easy and painless to lazily load one or more external
JavaScript or CSS files on demand either during or after the rendering of a web
page.

Supported browsers include Firefox 2+, IE6+, Safari 3+ (including Mobile
Safari), Google Chrome, and Opera 9+. Other browsers may or may not work and
are not officially supported.

Visit https://github.com/rgrove/lazyload/ for more info.

Copyright (c) 2011 Ryan Grove <ryan@wonko.com>
All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the 'Software'), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

@module lazyload
@class LazyLoad
@static
*/

LazyLoad = (function (doc) {
  // -- Private Variables ------------------------------------------------------

  // User agent and feature test information.
  var env,

  // Reference to the <head> element (populated lazily).
  head,

  // Requests currently in progress, if any.
  pending = {},

  // Number of times we've polled to check whether a pending stylesheet has
  // finished loading. If this gets too high, we're probably stalled.
  pollCount = 0,

  // Queued requests.
  queue = {css: [], js: []},

  // Reference to the browser's list of stylesheets.
  styleSheets = doc.styleSheets;

  // -- Private Methods --------------------------------------------------------

  /**
  Creates and returns an HTML element with the specified name and attributes.

  @method createNode
  @param {String} name element name
  @param {Object} attrs name/value mapping of element attributes
  @return {HTMLElement}
  @private
  */
  function createNode(name, attrs) {
    var node = doc.createElement(name), attr;

    for (attr in attrs) {
      if (attrs.hasOwnProperty(attr)) {
        node.setAttribute(attr, attrs[attr]);
      }
    }

    return node;
  }

  /**
  Called when the current pending resource of the specified type has finished
  loading. Executes the associated callback (if any) and loads the next
  resource in the queue.

  @method finish
  @param {String} type resource type ('css' or 'js')
  @private
  */
  function finish(type) {
    var p = pending[type],
        callback,
        urls;

    if (p) {
      callback = p.callback;
      urls     = p.urls;

      urls.shift();
      pollCount = 0;

      // If this is the last of the pending URLs, execute the callback and
      // start the next request in the queue (if any).
      if (!urls.length) {
        callback && callback.call(p.context, p.obj);
        pending[type] = null;
        queue[type].length && load(type);
      }
    }
  }

  /**
  Populates the <code>env</code> variable with user agent and feature test
  information.

  @method getEnv
  @private
  */
  function getEnv() {
    var ua = navigator.userAgent;

    env = {
      // True if this browser supports disabling async mode on dynamically
      // created script nodes. See
      // http://wiki.whatwg.org/wiki/Dynamic_Script_Execution_Order
      async: doc.createElement('script').async === true
    };

    (env.webkit = /AppleWebKit\//.test(ua))
      || (env.ie = /MSIE|Trident/.test(ua))
      || (env.opera = /Opera/.test(ua))
      || (env.gecko = /Gecko\//.test(ua))
      || (env.unknown = true);
  }

  /**
  Loads the specified resources, or the next resource of the specified type
  in the queue if no resources are specified. If a resource of the specified
  type is already being loaded, the new request will be queued until the
  first request has been finished.

  When an array of resource URLs is specified, those URLs will be loaded in
  parallel if it is possible to do so while preserving execution order. All
  browsers support parallel loading of CSS, but only Firefox and Opera
  support parallel loading of scripts. In other browsers, scripts will be
  queued and loaded one at a time to ensure correct execution order.

  @method load
  @param {String} type resource type ('css' or 'js')
  @param {String|Array} urls (optional) URL or array of URLs to load
  @param {Function} callback (optional) callback function to execute when the
    resource is loaded
  @param {Object} obj (optional) object to pass to the callback function
  @param {Object} context (optional) if provided, the callback function will
    be executed in this object's context
  @private
  */
  function load(type, urls, callback, obj, context) {
    var _finish = function () { finish(type); },
        isCSS   = type === 'css',
        nodes   = [],
        i, len, node, p, pendingUrls, url;

    env || getEnv();

    if (urls) {
      // If urls is a string, wrap it in an array. Otherwise assume it's an
      // array and create a copy of it so modifications won't be made to the
      // original.
      urls = typeof urls === 'string' ? [urls] : urls.concat();

      // Create a request object for each URL. If multiple URLs are specified,
      // the callback will only be executed after all URLs have been loaded.
      //
      // Sadly, Firefox and Opera are the only browsers capable of loading
      // scripts in parallel while preserving execution order. In all other
      // browsers, scripts must be loaded sequentially.
      //
      // All browsers respect CSS specificity based on the order of the link
      // elements in the DOM, regardless of the order in which the stylesheets
      // are actually downloaded.
      if (isCSS || env.async || env.gecko || env.opera) {
        // Load in parallel.
        queue[type].push({
          urls    : urls,
          callback: callback,
          obj     : obj,
          context : context
        });
      } else {
        // Load sequentially.
        for (i = 0, len = urls.length; i < len; ++i) {
          queue[type].push({
            urls    : [urls[i]],
            callback: i === len - 1 ? callback : null, // callback is only added to the last URL
            obj     : obj,
            context : context
          });
        }
      }
    }

    // If a previous load request of this type is currently in progress, we'll
    // wait our turn. Otherwise, grab the next item in the queue.
    if (pending[type] || !(p = pending[type] = queue[type].shift())) {
      return;
    }

    head || (head = doc.head || doc.getElementsByTagName('head')[0]);
    pendingUrls = p.urls.concat();

    for (i = 0, len = pendingUrls.length; i < len; ++i) {
      url = pendingUrls[i];

      if (isCSS) {
          node = env.gecko ? createNode('style') : createNode('link', {
            href: url,
            rel : 'stylesheet'
          });
      } else {
        node = createNode('script', {src: url});
        node.async = false;
      }

      node.className = 'lazyload';
      node.setAttribute('charset', 'utf-8');

      if (env.ie && !isCSS && 'onreadystatechange' in node && !('draggable' in node)) {
        node.onreadystatechange = function () {
          if (/loaded|complete/.test(node.readyState)) {
            node.onreadystatechange = null;
            _finish();
          }
        };
      } else if (isCSS && (env.gecko || env.webkit)) {
        // Gecko and WebKit don't support the onload event on link nodes.
        if (env.webkit) {
          // In WebKit, we can poll for changes to document.styleSheets to
          // figure out when stylesheets have loaded.
          p.urls[i] = node.href; // resolve relative URLs (or polling won't work)
          pollWebKit();
        } else {
          // In Gecko, we can import the requested URL into a <style> node and
          // poll for the existence of node.sheet.cssRules. Props to Zach
          // Leatherman for calling my attention to this technique.
          node.innerHTML = '@import "' + url + '";';
          pollGecko(node);
        }
      } else {
        node.onload = node.onerror = _finish;
      }

      nodes.push(node);
    }

    for (i = 0, len = nodes.length; i < len; ++i) {
      head.appendChild(nodes[i]);
    }
  }

  /**
  Begins polling to determine when the specified stylesheet has finished loading
  in Gecko. Polling stops when all pending stylesheets have loaded or after 10
  seconds (to prevent stalls).

  Thanks to Zach Leatherman for calling my attention to the @import-based
  cross-domain technique used here, and to Oleg Slobodskoi for an earlier
  same-domain implementation. See Zach's blog for more details:
  http://www.zachleat.com/web/2010/07/29/load-css-dynamically/

  @method pollGecko
  @param {HTMLElement} node Style node to poll.
  @private
  */
  function pollGecko(node) {
    var hasRules;

    try {
      // We don't really need to store this value or ever refer to it again, but
      // if we don't store it, Closure Compiler assumes the code is useless and
      // removes it.
      hasRules = !!node.sheet.cssRules;
    } catch (ex) {
      // An exception means the stylesheet is still loading.
      pollCount += 1;

      if (pollCount < 200) {
        setTimeout(function () { pollGecko(node); }, 50);
      } else {
        // We've been polling for 10 seconds and nothing's happened. Stop
        // polling and finish the pending requests to avoid blocking further
        // requests.
        hasRules && finish('css');
      }

      return;
    }

    // If we get here, the stylesheet has loaded.
    finish('css');
  }

  /**
  Begins polling to determine when pending stylesheets have finished loading
  in WebKit. Polling stops when all pending stylesheets have loaded or after 10
  seconds (to prevent stalls).

  @method pollWebKit
  @private
  */
  function pollWebKit() {
    var css = pending.css, i;

    if (css) {
      i = styleSheets.length;

      // Look for a stylesheet matching the pending URL.
      while (--i >= 0) {
        if (styleSheets[i].href === css.urls[0]) {
          finish('css');
          break;
        }
      }

      pollCount += 1;

      if (css) {
        if (pollCount < 200) {
          setTimeout(pollWebKit, 50);
        } else {
          // We've been polling for 10 seconds and nothing's happened, which may
          // indicate that the stylesheet has been removed from the document
          // before it had a chance to load. Stop polling and finish the pending
          // request to prevent blocking further requests.
          finish('css');
        }
      }
    }
  }

  return {

    /**
    Requests the specified CSS URL or URLs and executes the specified
    callback (if any) when they have finished loading. If an array of URLs is
    specified, the stylesheets will be loaded in parallel and the callback
    will be executed after all stylesheets have finished loading.

    @method css
    @param {String|Array} urls CSS URL or array of CSS URLs to load
    @param {Function} callback (optional) callback function to execute when
      the specified stylesheets are loaded
    @param {Object} obj (optional) object to pass to the callback function
    @param {Object} context (optional) if provided, the callback function
      will be executed in this object's context
    @static
    */
    css: function (urls, callback, obj, context) {
      load('css', urls, callback, obj, context);
    },

    /**
    Requests the specified JavaScript URL or URLs and executes the specified
    callback (if any) when they have finished loading. If an array of URLs is
    specified and the browser supports it, the scripts will be loaded in
    parallel and the callback will be executed after all scripts have
    finished loading.

    Currently, only Firefox and Opera support parallel loading of scripts while
    preserving execution order. In other browsers, scripts will be
    queued and loaded one at a time to ensure correct execution order.

    @method js
    @param {String|Array} urls JS URL or array of JS URLs to load
    @param {Function} callback (optional) callback function to execute when
      the specified scripts are loaded
    @param {Object} obj (optional) object to pass to the callback function
    @param {Object} context (optional) if provided, the callback function
      will be executed in this object's context
    @static
    */
    js: function (urls, callback, obj, context) {
      load('js', urls, callback, obj, context);
    }

  };
})(this.document);;/* Modernizr 2.8.3 (Custom Build) | MIT & BSD
 * Build: http://modernizr.com/download/#-geolocation-inlinesvg-svg-shiv-cssclasses-cors-load
 */
;



window.Modernizr = (function( window, document, undefined ) {

    var version = '2.8.3',

    Modernizr = {},

    enableClasses = true,

    docElement = document.documentElement,

    mod = 'modernizr',
    modElem = document.createElement(mod),
    mStyle = modElem.style,

    inputElem  ,


    toString = {}.toString,



    ns = {'svg': 'http://www.w3.org/2000/svg'},

    tests = {},
    inputs = {},
    attrs = {},

    classes = [],

    slice = classes.slice,

    featureName,



    _hasOwnProperty = ({}).hasOwnProperty, hasOwnProp;

    if ( !is(_hasOwnProperty, 'undefined') && !is(_hasOwnProperty.call, 'undefined') ) {
      hasOwnProp = function (object, property) {
        return _hasOwnProperty.call(object, property);
      };
    }
    else {
      hasOwnProp = function (object, property) { 
        return ((property in object) && is(object.constructor.prototype[property], 'undefined'));
      };
    }


    if (!Function.prototype.bind) {
      Function.prototype.bind = function bind(that) {

        var target = this;

        if (typeof target != "function") {
            throw new TypeError();
        }

        var args = slice.call(arguments, 1),
            bound = function () {

            if (this instanceof bound) {

              var F = function(){};
              F.prototype = target.prototype;
              var self = new F();

              var result = target.apply(
                  self,
                  args.concat(slice.call(arguments))
              );
              if (Object(result) === result) {
                  return result;
              }
              return self;

            } else {

              return target.apply(
                  that,
                  args.concat(slice.call(arguments))
              );

            }

        };

        return bound;
      };
    }

    function setCss( str ) {
        mStyle.cssText = str;
    }

    function setCssAll( str1, str2 ) {
        return setCss(prefixes.join(str1 + ';') + ( str2 || '' ));
    }

    function is( obj, type ) {
        return typeof obj === type;
    }

    function contains( str, substr ) {
        return !!~('' + str).indexOf(substr);
    }


    function testDOMProps( props, obj, elem ) {
        for ( var i in props ) {
            var item = obj[props[i]];
            if ( item !== undefined) {

                            if (elem === false) return props[i];

                            if (is(item, 'function')){
                                return item.bind(elem || obj);
                }

                            return item;
            }
        }
        return false;
    }



    tests['geolocation'] = function() {
        return 'geolocation' in navigator;
    };


    tests['svg'] = function() {
        return !!document.createElementNS && !!document.createElementNS(ns.svg, 'svg').createSVGRect;
    };

    tests['inlinesvg'] = function() {
      var div = document.createElement('div');
      div.innerHTML = '<svg/>';
      return (div.firstChild && div.firstChild.namespaceURI) == ns.svg;
    };    for ( var feature in tests ) {
        if ( hasOwnProp(tests, feature) ) {
                                    featureName  = feature.toLowerCase();
            Modernizr[featureName] = tests[feature]();

            classes.push((Modernizr[featureName] ? '' : 'no-') + featureName);
        }
    }



     Modernizr.addTest = function ( feature, test ) {
       if ( typeof feature == 'object' ) {
         for ( var key in feature ) {
           if ( hasOwnProp( feature, key ) ) {
             Modernizr.addTest( key, feature[ key ] );
           }
         }
       } else {

         feature = feature.toLowerCase();

         if ( Modernizr[feature] !== undefined ) {
                                              return Modernizr;
         }

         test = typeof test == 'function' ? test() : test;

         if (typeof enableClasses !== "undefined" && enableClasses) {
           docElement.className += ' ' + (test ? '' : 'no-') + feature;
         }
         Modernizr[feature] = test;

       }

       return Modernizr; 
     };


    setCss('');
    modElem = inputElem = null;

    ;(function(window, document) {
                var version = '3.7.0';

            var options = window.html5 || {};

            var reSkip = /^<|^(?:button|map|select|textarea|object|iframe|option|optgroup)$/i;

            var saveClones = /^(?:a|b|code|div|fieldset|h1|h2|h3|h4|h5|h6|i|label|li|ol|p|q|span|strong|style|table|tbody|td|th|tr|ul)$/i;

            var supportsHtml5Styles;

            var expando = '_html5shiv';

            var expanID = 0;

            var expandoData = {};

            var supportsUnknownElements;

        (function() {
          try {
            var a = document.createElement('a');
            a.innerHTML = '<xyz></xyz>';
                    supportsHtml5Styles = ('hidden' in a);

            supportsUnknownElements = a.childNodes.length == 1 || (function() {
                        (document.createElement)('a');
              var frag = document.createDocumentFragment();
              return (
                typeof frag.cloneNode == 'undefined' ||
                typeof frag.createDocumentFragment == 'undefined' ||
                typeof frag.createElement == 'undefined'
              );
            }());
          } catch(e) {
                    supportsHtml5Styles = true;
            supportsUnknownElements = true;
          }

        }());

            function addStyleSheet(ownerDocument, cssText) {
          var p = ownerDocument.createElement('p'),
          parent = ownerDocument.getElementsByTagName('head')[0] || ownerDocument.documentElement;

          p.innerHTML = 'x<style>' + cssText + '</style>';
          return parent.insertBefore(p.lastChild, parent.firstChild);
        }

            function getElements() {
          var elements = html5.elements;
          return typeof elements == 'string' ? elements.split(' ') : elements;
        }

            function getExpandoData(ownerDocument) {
          var data = expandoData[ownerDocument[expando]];
          if (!data) {
            data = {};
            expanID++;
            ownerDocument[expando] = expanID;
            expandoData[expanID] = data;
          }
          return data;
        }

            function createElement(nodeName, ownerDocument, data){
          if (!ownerDocument) {
            ownerDocument = document;
          }
          if(supportsUnknownElements){
            return ownerDocument.createElement(nodeName);
          }
          if (!data) {
            data = getExpandoData(ownerDocument);
          }
          var node;

          if (data.cache[nodeName]) {
            node = data.cache[nodeName].cloneNode();
          } else if (saveClones.test(nodeName)) {
            node = (data.cache[nodeName] = data.createElem(nodeName)).cloneNode();
          } else {
            node = data.createElem(nodeName);
          }

                                                    return node.canHaveChildren && !reSkip.test(nodeName) && !node.tagUrn ? data.frag.appendChild(node) : node;
        }

            function createDocumentFragment(ownerDocument, data){
          if (!ownerDocument) {
            ownerDocument = document;
          }
          if(supportsUnknownElements){
            return ownerDocument.createDocumentFragment();
          }
          data = data || getExpandoData(ownerDocument);
          var clone = data.frag.cloneNode(),
          i = 0,
          elems = getElements(),
          l = elems.length;
          for(;i<l;i++){
            clone.createElement(elems[i]);
          }
          return clone;
        }

            function shivMethods(ownerDocument, data) {
          if (!data.cache) {
            data.cache = {};
            data.createElem = ownerDocument.createElement;
            data.createFrag = ownerDocument.createDocumentFragment;
            data.frag = data.createFrag();
          }


          ownerDocument.createElement = function(nodeName) {
                    if (!html5.shivMethods) {
              return data.createElem(nodeName);
            }
            return createElement(nodeName, ownerDocument, data);
          };

          ownerDocument.createDocumentFragment = Function('h,f', 'return function(){' +
                                                          'var n=f.cloneNode(),c=n.createElement;' +
                                                          'h.shivMethods&&(' +
                                                                                                                getElements().join().replace(/[\w\-]+/g, function(nodeName) {
            data.createElem(nodeName);
            data.frag.createElement(nodeName);
            return 'c("' + nodeName + '")';
          }) +
            ');return n}'
                                                         )(html5, data.frag);
        }

            function shivDocument(ownerDocument) {
          if (!ownerDocument) {
            ownerDocument = document;
          }
          var data = getExpandoData(ownerDocument);

          if (html5.shivCSS && !supportsHtml5Styles && !data.hasCSS) {
            data.hasCSS = !!addStyleSheet(ownerDocument,
                                                                                'article,aside,dialog,figcaption,figure,footer,header,hgroup,main,nav,section{display:block}' +
                                                                                    'mark{background:#FF0;color:#000}' +
                                                                                    'template{display:none}'
                                         );
          }
          if (!supportsUnknownElements) {
            shivMethods(ownerDocument, data);
          }
          return ownerDocument;
        }

            var html5 = {

                'elements': options.elements || 'abbr article aside audio bdi canvas data datalist details dialog figcaption figure footer header hgroup main mark meter nav output progress section summary template time video',

                'version': version,

                'shivCSS': (options.shivCSS !== false),

                'supportsUnknownElements': supportsUnknownElements,

                'shivMethods': (options.shivMethods !== false),

                'type': 'default',

                'shivDocument': shivDocument,

                createElement: createElement,

                createDocumentFragment: createDocumentFragment
        };

            window.html5 = html5;

            shivDocument(document);

    }(this, document));

    Modernizr._version      = version;

    docElement.className = docElement.className.replace(/(^|\s)no-js(\s|$)/, '$1$2') +

                                                    (enableClasses ? ' js ' + classes.join(' ') : '');

    return Modernizr;

})(this, this.document);
/*yepnope1.5.4|WTFPL*/
(function(a,b,c){function d(a){return"[object Function]"==o.call(a)}function e(a){return"string"==typeof a}function f(){}function g(a){return!a||"loaded"==a||"complete"==a||"uninitialized"==a}function h(){var a=p.shift();q=1,a?a.t?m(function(){("c"==a.t?B.injectCss:B.injectJs)(a.s,0,a.a,a.x,a.e,1)},0):(a(),h()):q=0}function i(a,c,d,e,f,i,j){function k(b){if(!o&&g(l.readyState)&&(u.r=o=1,!q&&h(),l.onload=l.onreadystatechange=null,b)){"img"!=a&&m(function(){t.removeChild(l)},50);for(var d in y[c])y[c].hasOwnProperty(d)&&y[c][d].onload()}}var j=j||B.errorTimeout,l=b.createElement(a),o=0,r=0,u={t:d,s:c,e:f,a:i,x:j};1===y[c]&&(r=1,y[c]=[]),"object"==a?l.data=c:(l.src=c,l.type=a),l.width=l.height="0",l.onerror=l.onload=l.onreadystatechange=function(){k.call(this,r)},p.splice(e,0,u),"img"!=a&&(r||2===y[c]?(t.insertBefore(l,s?null:n),m(k,j)):y[c].push(l))}function j(a,b,c,d,f){return q=0,b=b||"j",e(a)?i("c"==b?v:u,a,b,this.i++,c,d,f):(p.splice(this.i++,0,a),1==p.length&&h()),this}function k(){var a=B;return a.loader={load:j,i:0},a}var l=b.documentElement,m=a.setTimeout,n=b.getElementsByTagName("script")[0],o={}.toString,p=[],q=0,r="MozAppearance"in l.style,s=r&&!!b.createRange().compareNode,t=s?l:n.parentNode,l=a.opera&&"[object Opera]"==o.call(a.opera),l=!!b.attachEvent&&!l,u=r?"object":l?"script":"img",v=l?"script":u,w=Array.isArray||function(a){return"[object Array]"==o.call(a)},x=[],y={},z={timeout:function(a,b){return b.length&&(a.timeout=b[0]),a}},A,B;B=function(a){function b(a){var a=a.split("!"),b=x.length,c=a.pop(),d=a.length,c={url:c,origUrl:c,prefixes:a},e,f,g;for(f=0;f<d;f++)g=a[f].split("="),(e=z[g.shift()])&&(c=e(c,g));for(f=0;f<b;f++)c=x[f](c);return c}function g(a,e,f,g,h){var i=b(a),j=i.autoCallback;i.url.split(".").pop().split("?").shift(),i.bypass||(e&&(e=d(e)?e:e[a]||e[g]||e[a.split("/").pop().split("?")[0]]),i.instead?i.instead(a,e,f,g,h):(y[i.url]?i.noexec=!0:y[i.url]=1,f.load(i.url,i.forceCSS||!i.forceJS&&"css"==i.url.split(".").pop().split("?").shift()?"c":c,i.noexec,i.attrs,i.timeout),(d(e)||d(j))&&f.load(function(){k(),e&&e(i.origUrl,h,g),j&&j(i.origUrl,h,g),y[i.url]=2})))}function h(a,b){function c(a,c){if(a){if(e(a))c||(j=function(){var a=[].slice.call(arguments);k.apply(this,a),l()}),g(a,j,b,0,h);else if(Object(a)===a)for(n in m=function(){var b=0,c;for(c in a)a.hasOwnProperty(c)&&b++;return b}(),a)a.hasOwnProperty(n)&&(!c&&!--m&&(d(j)?j=function(){var a=[].slice.call(arguments);k.apply(this,a),l()}:j[n]=function(a){return function(){var b=[].slice.call(arguments);a&&a.apply(this,b),l()}}(k[n])),g(a[n],j,b,n,h))}else!c&&l()}var h=!!a.test,i=a.load||a.both,j=a.callback||f,k=j,l=a.complete||f,m,n;c(h?a.yep:a.nope,!!i),i&&c(i)}var i,j,l=this.yepnope.loader;if(e(a))g(a,0,l,0);else if(w(a))for(i=0;i<a.length;i++)j=a[i],e(j)?g(j,0,l,0):w(j)?B(j):Object(j)===j&&h(j,l);else Object(a)===a&&h(a,l)},B.addPrefix=function(a,b){z[a]=b},B.addFilter=function(a){x.push(a)},B.errorTimeout=1e4,null==b.readyState&&b.addEventListener&&(b.readyState="loading",b.addEventListener("DOMContentLoaded",A=function(){b.removeEventListener("DOMContentLoaded",A,0),b.readyState="complete"},0)),a.yepnope=k(),a.yepnope.executeStack=h,a.yepnope.injectJs=function(a,c,d,e,i,j){var k=b.createElement("script"),l,o,e=e||B.errorTimeout;k.src=a;for(o in d)k.setAttribute(o,d[o]);c=j?h:c||f,k.onreadystatechange=k.onload=function(){!l&&g(k.readyState)&&(l=1,c(),k.onload=k.onreadystatechange=null)},m(function(){l||(l=1,c(1))},e),i?k.onload():n.parentNode.insertBefore(k,n)},a.yepnope.injectCss=function(a,c,d,e,g,i){var e=b.createElement("link"),j,c=i?h:c||f;e.href=a,e.rel="stylesheet",e.type="text/css";for(j in d)e.setAttribute(j,d[j]);g||(n.parentNode.insertBefore(e,n),m(c,0))}})(this,document);
Modernizr.load=function(){yepnope.apply(window,[].slice.call(arguments,0));};
// cors
// By Theodoor van Donge
Modernizr.addTest('cors', !!(window.XMLHttpRequest && 'withCredentials' in new XMLHttpRequest()));;;//! moment.js
//! version : 2.7.0
//! authors : Tim Wood, Iskren Chernev, Moment.js contributors
//! license : MIT
//! momentjs.com

(function (undefined) {

    /************************************
        Constants
    ************************************/

    var moment,
        VERSION = "2.7.0",
        // the global-scope this is NOT the global object in Node.js
        globalScope = typeof global !== 'undefined' ? global : this,
        oldGlobalMoment,
        round = Math.round,
        i,

        YEAR = 0,
        MONTH = 1,
        DATE = 2,
        HOUR = 3,
        MINUTE = 4,
        SECOND = 5,
        MILLISECOND = 6,

        // internal storage for language config files
        languages = {},

        // moment internal properties
        momentProperties = {
            _isAMomentObject: null,
            _i : null,
            _f : null,
            _l : null,
            _strict : null,
            _tzm : null,
            _isUTC : null,
            _offset : null,  // optional. Combine with _isUTC
            _pf : null,
            _lang : null  // optional
        },

        // check for nodeJS
        hasModule = (typeof module !== 'undefined' && module.exports),

        // ASP.NET json date format regex
        aspNetJsonRegex = /^\/?Date\((\-?\d+)/i,
        aspNetTimeSpanJsonRegex = /(\-)?(?:(\d*)\.)?(\d+)\:(\d+)(?:\:(\d+)\.?(\d{3})?)?/,

        // from http://docs.closure-library.googlecode.com/git/closure_goog_date_date.js.source.html
        // somewhat more in line with 4.4.3.2 2004 spec, but allows decimal anywhere
        isoDurationRegex = /^(-)?P(?:(?:([0-9,.]*)Y)?(?:([0-9,.]*)M)?(?:([0-9,.]*)D)?(?:T(?:([0-9,.]*)H)?(?:([0-9,.]*)M)?(?:([0-9,.]*)S)?)?|([0-9,.]*)W)$/,

        // format tokens
        formattingTokens = /(\[[^\[]*\])|(\\)?(Mo|MM?M?M?|Do|DDDo|DD?D?D?|ddd?d?|do?|w[o|w]?|W[o|W]?|Q|YYYYYY|YYYYY|YYYY|YY|gg(ggg?)?|GG(GGG?)?|e|E|a|A|hh?|HH?|mm?|ss?|S{1,4}|X|zz?|ZZ?|.)/g,
        localFormattingTokens = /(\[[^\[]*\])|(\\)?(LT|LL?L?L?|l{1,4})/g,

        // parsing token regexes
        parseTokenOneOrTwoDigits = /\d\d?/, // 0 - 99
        parseTokenOneToThreeDigits = /\d{1,3}/, // 0 - 999
        parseTokenOneToFourDigits = /\d{1,4}/, // 0 - 9999
        parseTokenOneToSixDigits = /[+\-]?\d{1,6}/, // -999,999 - 999,999
        parseTokenDigits = /\d+/, // nonzero number of digits
        parseTokenWord = /[0-9]*['a-z\u00A0-\u05FF\u0700-\uD7FF\uF900-\uFDCF\uFDF0-\uFFEF]+|[\u0600-\u06FF\/]+(\s*?[\u0600-\u06FF]+){1,2}/i, // any word (or two) characters or numbers including two/three word month in arabic.
        parseTokenTimezone = /Z|[\+\-]\d\d:?\d\d/gi, // +00:00 -00:00 +0000 -0000 or Z
        parseTokenT = /T/i, // T (ISO separator)
        parseTokenTimestampMs = /[\+\-]?\d+(\.\d{1,3})?/, // 123456789 123456789.123
        parseTokenOrdinal = /\d{1,2}/,

        //strict parsing regexes
        parseTokenOneDigit = /\d/, // 0 - 9
        parseTokenTwoDigits = /\d\d/, // 00 - 99
        parseTokenThreeDigits = /\d{3}/, // 000 - 999
        parseTokenFourDigits = /\d{4}/, // 0000 - 9999
        parseTokenSixDigits = /[+-]?\d{6}/, // -999,999 - 999,999
        parseTokenSignedNumber = /[+-]?\d+/, // -inf - inf

        // iso 8601 regex
        // 0000-00-00 0000-W00 or 0000-W00-0 + T + 00 or 00:00 or 00:00:00 or 00:00:00.000 + +00:00 or +0000 or +00)
        isoRegex = /^\s*(?:[+-]\d{6}|\d{4})-(?:(\d\d-\d\d)|(W\d\d$)|(W\d\d-\d)|(\d\d\d))((T| )(\d\d(:\d\d(:\d\d(\.\d+)?)?)?)?([\+\-]\d\d(?::?\d\d)?|\s*Z)?)?$/,

        isoFormat = 'YYYY-MM-DDTHH:mm:ssZ',

        isoDates = [
            ['YYYYYY-MM-DD', /[+-]\d{6}-\d{2}-\d{2}/],
            ['YYYY-MM-DD', /\d{4}-\d{2}-\d{2}/],
            ['GGGG-[W]WW-E', /\d{4}-W\d{2}-\d/],
            ['GGGG-[W]WW', /\d{4}-W\d{2}/],
            ['YYYY-DDD', /\d{4}-\d{3}/]
        ],

        // iso time formats and regexes
        isoTimes = [
            ['HH:mm:ss.SSSS', /(T| )\d\d:\d\d:\d\d\.\d+/],
            ['HH:mm:ss', /(T| )\d\d:\d\d:\d\d/],
            ['HH:mm', /(T| )\d\d:\d\d/],
            ['HH', /(T| )\d\d/]
        ],

        // timezone chunker "+10:00" > ["10", "00"] or "-1530" > ["-15", "30"]
        parseTimezoneChunker = /([\+\-]|\d\d)/gi,

        // getter and setter names
        proxyGettersAndSetters = 'Date|Hours|Minutes|Seconds|Milliseconds'.split('|'),
        unitMillisecondFactors = {
            'Milliseconds' : 1,
            'Seconds' : 1e3,
            'Minutes' : 6e4,
            'Hours' : 36e5,
            'Days' : 864e5,
            'Months' : 2592e6,
            'Years' : 31536e6
        },

        unitAliases = {
            ms : 'millisecond',
            s : 'second',
            m : 'minute',
            h : 'hour',
            d : 'day',
            D : 'date',
            w : 'week',
            W : 'isoWeek',
            M : 'month',
            Q : 'quarter',
            y : 'year',
            DDD : 'dayOfYear',
            e : 'weekday',
            E : 'isoWeekday',
            gg: 'weekYear',
            GG: 'isoWeekYear'
        },

        camelFunctions = {
            dayofyear : 'dayOfYear',
            isoweekday : 'isoWeekday',
            isoweek : 'isoWeek',
            weekyear : 'weekYear',
            isoweekyear : 'isoWeekYear'
        },

        // format function strings
        formatFunctions = {},

        // default relative time thresholds
        relativeTimeThresholds = {
            s: 45,  // seconds to minute
            m: 45,  // minutes to hour
            h: 22,  // hours to day
            d: 26,  // days to month
            M: 11   // months to year
        },

        // tokens to ordinalize and pad
        ordinalizeTokens = 'DDD w W M D d'.split(' '),
        paddedTokens = 'M D H h m s w W'.split(' '),

        formatTokenFunctions = {
            M    : function () {
                return this.month() + 1;
            },
            MMM  : function (format) {
                return this.lang().monthsShort(this, format);
            },
            MMMM : function (format) {
                return this.lang().months(this, format);
            },
            D    : function () {
                return this.date();
            },
            DDD  : function () {
                return this.dayOfYear();
            },
            d    : function () {
                return this.day();
            },
            dd   : function (format) {
                return this.lang().weekdaysMin(this, format);
            },
            ddd  : function (format) {
                return this.lang().weekdaysShort(this, format);
            },
            dddd : function (format) {
                return this.lang().weekdays(this, format);
            },
            w    : function () {
                return this.week();
            },
            W    : function () {
                return this.isoWeek();
            },
            YY   : function () {
                return leftZeroFill(this.year() % 100, 2);
            },
            YYYY : function () {
                return leftZeroFill(this.year(), 4);
            },
            YYYYY : function () {
                return leftZeroFill(this.year(), 5);
            },
            YYYYYY : function () {
                var y = this.year(), sign = y >= 0 ? '+' : '-';
                return sign + leftZeroFill(Math.abs(y), 6);
            },
            gg   : function () {
                return leftZeroFill(this.weekYear() % 100, 2);
            },
            gggg : function () {
                return leftZeroFill(this.weekYear(), 4);
            },
            ggggg : function () {
                return leftZeroFill(this.weekYear(), 5);
            },
            GG   : function () {
                return leftZeroFill(this.isoWeekYear() % 100, 2);
            },
            GGGG : function () {
                return leftZeroFill(this.isoWeekYear(), 4);
            },
            GGGGG : function () {
                return leftZeroFill(this.isoWeekYear(), 5);
            },
            e : function () {
                return this.weekday();
            },
            E : function () {
                return this.isoWeekday();
            },
            a    : function () {
                return this.lang().meridiem(this.hours(), this.minutes(), true);
            },
            A    : function () {
                return this.lang().meridiem(this.hours(), this.minutes(), false);
            },
            H    : function () {
                return this.hours();
            },
            h    : function () {
                return this.hours() % 12 || 12;
            },
            m    : function () {
                return this.minutes();
            },
            s    : function () {
                return this.seconds();
            },
            S    : function () {
                return toInt(this.milliseconds() / 100);
            },
            SS   : function () {
                return leftZeroFill(toInt(this.milliseconds() / 10), 2);
            },
            SSS  : function () {
                return leftZeroFill(this.milliseconds(), 3);
            },
            SSSS : function () {
                return leftZeroFill(this.milliseconds(), 3);
            },
            Z    : function () {
                var a = -this.zone(),
                    b = "+";
                if (a < 0) {
                    a = -a;
                    b = "-";
                }
                return b + leftZeroFill(toInt(a / 60), 2) + ":" + leftZeroFill(toInt(a) % 60, 2);
            },
            ZZ   : function () {
                var a = -this.zone(),
                    b = "+";
                if (a < 0) {
                    a = -a;
                    b = "-";
                }
                return b + leftZeroFill(toInt(a / 60), 2) + leftZeroFill(toInt(a) % 60, 2);
            },
            z : function () {
                return this.zoneAbbr();
            },
            zz : function () {
                return this.zoneName();
            },
            X    : function () {
                return this.unix();
            },
            Q : function () {
                return this.quarter();
            }
        },

        lists = ['months', 'monthsShort', 'weekdays', 'weekdaysShort', 'weekdaysMin'];

    // Pick the first defined of two or three arguments. dfl comes from
    // default.
    function dfl(a, b, c) {
        switch (arguments.length) {
            case 2: return a != null ? a : b;
            case 3: return a != null ? a : b != null ? b : c;
            default: throw new Error("Implement me");
        }
    }

    function defaultParsingFlags() {
        // We need to deep clone this object, and es5 standard is not very
        // helpful.
        return {
            empty : false,
            unusedTokens : [],
            unusedInput : [],
            overflow : -2,
            charsLeftOver : 0,
            nullInput : false,
            invalidMonth : null,
            invalidFormat : false,
            userInvalidated : false,
            iso: false
        };
    }

    function deprecate(msg, fn) {
        var firstTime = true;
        function printMsg() {
            if (moment.suppressDeprecationWarnings === false &&
                    typeof console !== 'undefined' && console.warn) {
                console.warn("Deprecation warning: " + msg);
            }
        }
        return extend(function () {
            if (firstTime) {
                printMsg();
                firstTime = false;
            }
            return fn.apply(this, arguments);
        }, fn);
    }

    function padToken(func, count) {
        return function (a) {
            return leftZeroFill(func.call(this, a), count);
        };
    }
    function ordinalizeToken(func, period) {
        return function (a) {
            return this.lang().ordinal(func.call(this, a), period);
        };
    }

    while (ordinalizeTokens.length) {
        i = ordinalizeTokens.pop();
        formatTokenFunctions[i + 'o'] = ordinalizeToken(formatTokenFunctions[i], i);
    }
    while (paddedTokens.length) {
        i = paddedTokens.pop();
        formatTokenFunctions[i + i] = padToken(formatTokenFunctions[i], 2);
    }
    formatTokenFunctions.DDDD = padToken(formatTokenFunctions.DDD, 3);


    /************************************
        Constructors
    ************************************/

    function Language() {

    }

    // Moment prototype object
    function Moment(config) {
        checkOverflow(config);
        extend(this, config);
    }

    // Duration Constructor
    function Duration(duration) {
        var normalizedInput = normalizeObjectUnits(duration),
            years = normalizedInput.year || 0,
            quarters = normalizedInput.quarter || 0,
            months = normalizedInput.month || 0,
            weeks = normalizedInput.week || 0,
            days = normalizedInput.day || 0,
            hours = normalizedInput.hour || 0,
            minutes = normalizedInput.minute || 0,
            seconds = normalizedInput.second || 0,
            milliseconds = normalizedInput.millisecond || 0;

        // representation for dateAddRemove
        this._milliseconds = +milliseconds +
            seconds * 1e3 + // 1000
            minutes * 6e4 + // 1000 * 60
            hours * 36e5; // 1000 * 60 * 60
        // Because of dateAddRemove treats 24 hours as different from a
        // day when working around DST, we need to store them separately
        this._days = +days +
            weeks * 7;
        // It is impossible translate months into days without knowing
        // which months you are are talking about, so we have to store
        // it separately.
        this._months = +months +
            quarters * 3 +
            years * 12;

        this._data = {};

        this._bubble();
    }

    /************************************
        Helpers
    ************************************/


    function extend(a, b) {
        for (var i in b) {
            if (b.hasOwnProperty(i)) {
                a[i] = b[i];
            }
        }

        if (b.hasOwnProperty("toString")) {
            a.toString = b.toString;
        }

        if (b.hasOwnProperty("valueOf")) {
            a.valueOf = b.valueOf;
        }

        return a;
    }

    function cloneMoment(m) {
        var result = {}, i;
        for (i in m) {
            if (m.hasOwnProperty(i) && momentProperties.hasOwnProperty(i)) {
                result[i] = m[i];
            }
        }

        return result;
    }

    function absRound(number) {
        if (number < 0) {
            return Math.ceil(number);
        } else {
            return Math.floor(number);
        }
    }

    // left zero fill a number
    // see http://jsperf.com/left-zero-filling for performance comparison
    function leftZeroFill(number, targetLength, forceSign) {
        var output = '' + Math.abs(number),
            sign = number >= 0;

        while (output.length < targetLength) {
            output = '0' + output;
        }
        return (sign ? (forceSign ? '+' : '') : '-') + output;
    }

    function positiveMomentsDifference(base, other) {
        var res = {milliseconds: 0, months: 0};

        res.months = other.month() - base.month() +
            (other.year() - base.year()) * 12;
        if (base.clone().add(res.months, 'M').isAfter(other)) {
            --res.months;
        }

        res.milliseconds = +other - +(base.clone().add(res.months, 'M'));

        return res;
    }

    function momentsDifference(base, other) {
        var res;
        other = makeAs(other, base);
        if (base.isBefore(other)) {
            res = positiveMomentsDifference(base, other);
        } else {
            res = positiveMomentsDifference(other, base);
            res.milliseconds = -res.milliseconds;
            res.months = -res.months;
        }

        return res;
    }

    // helper function for _.addTime and _.subtractTime
    function addOrSubtractDurationFromMoment(mom, duration, isAdding, updateOffset) {
        var milliseconds = duration._milliseconds,
            days = duration._days,
            months = duration._months;
        updateOffset = updateOffset == null ? true : updateOffset;

        if (milliseconds) {
            mom._d.setTime(+mom._d + milliseconds * isAdding);
        }
        if (days) {
            rawSetter(mom, 'Date', rawGetter(mom, 'Date') + days * isAdding);
        }
        if (months) {
            rawMonthSetter(mom, rawGetter(mom, 'Month') + months * isAdding);
        }
        if (updateOffset) {
            moment.updateOffset(mom, days || months);
        }
    }

    // check if is an array
    function isArray(input) {
        return Object.prototype.toString.call(input) === '[object Array]';
    }

    function isDate(input) {
        return Object.prototype.toString.call(input) === '[object Date]' ||
            input instanceof Date;
    }

    // compare two arrays, return the number of differences
    function compareArrays(array1, array2, dontConvert) {
        var len = Math.min(array1.length, array2.length),
            lengthDiff = Math.abs(array1.length - array2.length),
            diffs = 0,
            i;
        for (i = 0; i < len; i++) {
            if ((dontConvert && array1[i] !== array2[i]) ||
                (!dontConvert && toInt(array1[i]) !== toInt(array2[i]))) {
                diffs++;
            }
        }
        return diffs + lengthDiff;
    }

    function normalizeUnits(units) {
        if (units) {
            var lowered = units.toLowerCase().replace(/(.)s$/, '$1');
            units = unitAliases[units] || camelFunctions[lowered] || lowered;
        }
        return units;
    }

    function normalizeObjectUnits(inputObject) {
        var normalizedInput = {},
            normalizedProp,
            prop;

        for (prop in inputObject) {
            if (inputObject.hasOwnProperty(prop)) {
                normalizedProp = normalizeUnits(prop);
                if (normalizedProp) {
                    normalizedInput[normalizedProp] = inputObject[prop];
                }
            }
        }

        return normalizedInput;
    }

    function makeList(field) {
        var count, setter;

        if (field.indexOf('week') === 0) {
            count = 7;
            setter = 'day';
        }
        else if (field.indexOf('month') === 0) {
            count = 12;
            setter = 'month';
        }
        else {
            return;
        }

        moment[field] = function (format, index) {
            var i, getter,
                method = moment.fn._lang[field],
                results = [];

            if (typeof format === 'number') {
                index = format;
                format = undefined;
            }

            getter = function (i) {
                var m = moment().utc().set(setter, i);
                return method.call(moment.fn._lang, m, format || '');
            };

            if (index != null) {
                return getter(index);
            }
            else {
                for (i = 0; i < count; i++) {
                    results.push(getter(i));
                }
                return results;
            }
        };
    }

    function toInt(argumentForCoercion) {
        var coercedNumber = +argumentForCoercion,
            value = 0;

        if (coercedNumber !== 0 && isFinite(coercedNumber)) {
            if (coercedNumber >= 0) {
                value = Math.floor(coercedNumber);
            } else {
                value = Math.ceil(coercedNumber);
            }
        }

        return value;
    }

    function daysInMonth(year, month) {
        return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    }

    function weeksInYear(year, dow, doy) {
        return weekOfYear(moment([year, 11, 31 + dow - doy]), dow, doy).week;
    }

    function daysInYear(year) {
        return isLeapYear(year) ? 366 : 365;
    }

    function isLeapYear(year) {
        return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    }

    function checkOverflow(m) {
        var overflow;
        if (m._a && m._pf.overflow === -2) {
            overflow =
                m._a[MONTH] < 0 || m._a[MONTH] > 11 ? MONTH :
                m._a[DATE] < 1 || m._a[DATE] > daysInMonth(m._a[YEAR], m._a[MONTH]) ? DATE :
                m._a[HOUR] < 0 || m._a[HOUR] > 23 ? HOUR :
                m._a[MINUTE] < 0 || m._a[MINUTE] > 59 ? MINUTE :
                m._a[SECOND] < 0 || m._a[SECOND] > 59 ? SECOND :
                m._a[MILLISECOND] < 0 || m._a[MILLISECOND] > 999 ? MILLISECOND :
                -1;

            if (m._pf._overflowDayOfYear && (overflow < YEAR || overflow > DATE)) {
                overflow = DATE;
            }

            m._pf.overflow = overflow;
        }
    }

    function isValid(m) {
        if (m._isValid == null) {
            m._isValid = !isNaN(m._d.getTime()) &&
                m._pf.overflow < 0 &&
                !m._pf.empty &&
                !m._pf.invalidMonth &&
                !m._pf.nullInput &&
                !m._pf.invalidFormat &&
                !m._pf.userInvalidated;

            if (m._strict) {
                m._isValid = m._isValid &&
                    m._pf.charsLeftOver === 0 &&
                    m._pf.unusedTokens.length === 0;
            }
        }
        return m._isValid;
    }

    function normalizeLanguage(key) {
        return key ? key.toLowerCase().replace('_', '-') : key;
    }

    // Return a moment from input, that is local/utc/zone equivalent to model.
    function makeAs(input, model) {
        return model._isUTC ? moment(input).zone(model._offset || 0) :
            moment(input).local();
    }

    /************************************
        Languages
    ************************************/


    extend(Language.prototype, {

        set : function (config) {
            var prop, i;
            for (i in config) {
                prop = config[i];
                if (typeof prop === 'function') {
                    this[i] = prop;
                } else {
                    this['_' + i] = prop;
                }
            }
        },

        _months : "January_February_March_April_May_June_July_August_September_October_November_December".split("_"),
        months : function (m) {
            return this._months[m.month()];
        },

        _monthsShort : "Jan_Feb_Mar_Apr_May_Jun_Jul_Aug_Sep_Oct_Nov_Dec".split("_"),
        monthsShort : function (m) {
            return this._monthsShort[m.month()];
        },

        monthsParse : function (monthName) {
            var i, mom, regex;

            if (!this._monthsParse) {
                this._monthsParse = [];
            }

            for (i = 0; i < 12; i++) {
                // make the regex if we don't have it already
                if (!this._monthsParse[i]) {
                    mom = moment.utc([2000, i]);
                    regex = '^' + this.months(mom, '') + '|^' + this.monthsShort(mom, '');
                    this._monthsParse[i] = new RegExp(regex.replace('.', ''), 'i');
                }
                // test the regex
                if (this._monthsParse[i].test(monthName)) {
                    return i;
                }
            }
        },

        _weekdays : "Sunday_Monday_Tuesday_Wednesday_Thursday_Friday_Saturday".split("_"),
        weekdays : function (m) {
            return this._weekdays[m.day()];
        },

        _weekdaysShort : "Sun_Mon_Tue_Wed_Thu_Fri_Sat".split("_"),
        weekdaysShort : function (m) {
            return this._weekdaysShort[m.day()];
        },

        _weekdaysMin : "Su_Mo_Tu_We_Th_Fr_Sa".split("_"),
        weekdaysMin : function (m) {
            return this._weekdaysMin[m.day()];
        },

        weekdaysParse : function (weekdayName) {
            var i, mom, regex;

            if (!this._weekdaysParse) {
                this._weekdaysParse = [];
            }

            for (i = 0; i < 7; i++) {
                // make the regex if we don't have it already
                if (!this._weekdaysParse[i]) {
                    mom = moment([2000, 1]).day(i);
                    regex = '^' + this.weekdays(mom, '') + '|^' + this.weekdaysShort(mom, '') + '|^' + this.weekdaysMin(mom, '');
                    this._weekdaysParse[i] = new RegExp(regex.replace('.', ''), 'i');
                }
                // test the regex
                if (this._weekdaysParse[i].test(weekdayName)) {
                    return i;
                }
            }
        },

        _longDateFormat : {
            LT : "h:mm A",
            L : "MM/DD/YYYY",
            LL : "MMMM D YYYY",
            LLL : "MMMM D YYYY LT",
            LLLL : "dddd, MMMM D YYYY LT"
        },
        longDateFormat : function (key) {
            var output = this._longDateFormat[key];
            if (!output && this._longDateFormat[key.toUpperCase()]) {
                output = this._longDateFormat[key.toUpperCase()].replace(/MMMM|MM|DD|dddd/g, function (val) {
                    return val.slice(1);
                });
                this._longDateFormat[key] = output;
            }
            return output;
        },

        isPM : function (input) {
            // IE8 Quirks Mode & IE7 Standards Mode do not allow accessing strings like arrays
            // Using charAt should be more compatible.
            return ((input + '').toLowerCase().charAt(0) === 'p');
        },

        _meridiemParse : /[ap]\.?m?\.?/i,
        meridiem : function (hours, minutes, isLower) {
            if (hours > 11) {
                return isLower ? 'pm' : 'PM';
            } else {
                return isLower ? 'am' : 'AM';
            }
        },

        _calendar : {
            sameDay : '[Today at] LT',
            nextDay : '[Tomorrow at] LT',
            nextWeek : 'dddd [at] LT',
            lastDay : '[Yesterday at] LT',
            lastWeek : '[Last] dddd [at] LT',
            sameElse : 'L'
        },
        calendar : function (key, mom) {
            var output = this._calendar[key];
            return typeof output === 'function' ? output.apply(mom) : output;
        },

        _relativeTime : {
            future : "in %s",
            past : "%s ago",
            s : "a few seconds",
            m : "a minute",
            mm : "%d minutes",
            h : "an hour",
            hh : "%d hours",
            d : "a day",
            dd : "%d days",
            M : "a month",
            MM : "%d months",
            y : "a year",
            yy : "%d years"
        },

        relativeTime : function (number, withoutSuffix, string, isFuture) {
            var output = this._relativeTime[string];
            return (typeof output === 'function') ?
                output(number, withoutSuffix, string, isFuture) :
                output.replace(/%d/i, number);
        },

        pastFuture : function (diff, output) {
            var format = this._relativeTime[diff > 0 ? 'future' : 'past'];
            return typeof format === 'function' ? format(output) : format.replace(/%s/i, output);
        },

        ordinal : function (number) {
            return this._ordinal.replace("%d", number);
        },
        _ordinal : "%d",

        preparse : function (string) {
            return string;
        },

        postformat : function (string) {
            return string;
        },

        week : function (mom) {
            return weekOfYear(mom, this._week.dow, this._week.doy).week;
        },

        _week : {
            dow : 0, // Sunday is the first day of the week.
            doy : 6  // The week that contains Jan 1st is the first week of the year.
        },

        _invalidDate: 'Invalid date',
        invalidDate: function () {
            return this._invalidDate;
        }
    });

    // Loads a language definition into the `languages` cache.  The function
    // takes a key and optionally values.  If not in the browser and no values
    // are provided, it will load the language file module.  As a convenience,
    // this function also returns the language values.
    function loadLang(key, values) {
        values.abbr = key;
        if (!languages[key]) {
            languages[key] = new Language();
        }
        languages[key].set(values);
        return languages[key];
    }

    // Remove a language from the `languages` cache. Mostly useful in tests.
    function unloadLang(key) {
        delete languages[key];
    }

    // Determines which language definition to use and returns it.
    //
    // With no parameters, it will return the global language.  If you
    // pass in a language key, such as 'en', it will return the
    // definition for 'en', so long as 'en' has already been loaded using
    // moment.lang.
    function getLangDefinition(key) {
        var i = 0, j, lang, next, split,
            get = function (k) {
                if (!languages[k] && hasModule) {
                    try {
                        require('./lang/' + k);
                    } catch (e) { }
                }
                return languages[k];
            };

        if (!key) {
            return moment.fn._lang;
        }

        if (!isArray(key)) {
            //short-circuit everything else
            lang = get(key);
            if (lang) {
                return lang;
            }
            key = [key];
        }

        //pick the language from the array
        //try ['en-au', 'en-gb'] as 'en-au', 'en-gb', 'en', as in move through the list trying each
        //substring from most specific to least, but move to the next array item if it's a more specific variant than the current root
        while (i < key.length) {
            split = normalizeLanguage(key[i]).split('-');
            j = split.length;
            next = normalizeLanguage(key[i + 1]);
            next = next ? next.split('-') : null;
            while (j > 0) {
                lang = get(split.slice(0, j).join('-'));
                if (lang) {
                    return lang;
                }
                if (next && next.length >= j && compareArrays(split, next, true) >= j - 1) {
                    //the next array item is better than a shallower substring of this one
                    break;
                }
                j--;
            }
            i++;
        }
        return moment.fn._lang;
    }

    /************************************
        Formatting
    ************************************/


    function removeFormattingTokens(input) {
        if (input.match(/\[[\s\S]/)) {
            return input.replace(/^\[|\]$/g, "");
        }
        return input.replace(/\\/g, "");
    }

    function makeFormatFunction(format) {
        var array = format.match(formattingTokens), i, length;

        for (i = 0, length = array.length; i < length; i++) {
            if (formatTokenFunctions[array[i]]) {
                array[i] = formatTokenFunctions[array[i]];
            } else {
                array[i] = removeFormattingTokens(array[i]);
            }
        }

        return function (mom) {
            var output = "";
            for (i = 0; i < length; i++) {
                output += array[i] instanceof Function ? array[i].call(mom, format) : array[i];
            }
            return output;
        };
    }

    // format date using native date object
    function formatMoment(m, format) {

        if (!m.isValid()) {
            return m.lang().invalidDate();
        }

        format = expandFormat(format, m.lang());

        if (!formatFunctions[format]) {
            formatFunctions[format] = makeFormatFunction(format);
        }

        return formatFunctions[format](m);
    }

    function expandFormat(format, lang) {
        var i = 5;

        function replaceLongDateFormatTokens(input) {
            return lang.longDateFormat(input) || input;
        }

        localFormattingTokens.lastIndex = 0;
        while (i >= 0 && localFormattingTokens.test(format)) {
            format = format.replace(localFormattingTokens, replaceLongDateFormatTokens);
            localFormattingTokens.lastIndex = 0;
            i -= 1;
        }

        return format;
    }


    /************************************
        Parsing
    ************************************/


    // get the regex to find the next token
    function getParseRegexForToken(token, config) {
        var a, strict = config._strict;
        switch (token) {
        case 'Q':
            return parseTokenOneDigit;
        case 'DDDD':
            return parseTokenThreeDigits;
        case 'YYYY':
        case 'GGGG':
        case 'gggg':
            return strict ? parseTokenFourDigits : parseTokenOneToFourDigits;
        case 'Y':
        case 'G':
        case 'g':
            return parseTokenSignedNumber;
        case 'YYYYYY':
        case 'YYYYY':
        case 'GGGGG':
        case 'ggggg':
            return strict ? parseTokenSixDigits : parseTokenOneToSixDigits;
        case 'S':
            if (strict) {
                return parseTokenOneDigit;
            }
            /* falls through */
        case 'SS':
            if (strict) {
                return parseTokenTwoDigits;
            }
            /* falls through */
        case 'SSS':
            if (strict) {
                return parseTokenThreeDigits;
            }
            /* falls through */
        case 'DDD':
            return parseTokenOneToThreeDigits;
        case 'MMM':
        case 'MMMM':
        case 'dd':
        case 'ddd':
        case 'dddd':
            return parseTokenWord;
        case 'a':
        case 'A':
            return getLangDefinition(config._l)._meridiemParse;
        case 'X':
            return parseTokenTimestampMs;
        case 'Z':
        case 'ZZ':
            return parseTokenTimezone;
        case 'T':
            return parseTokenT;
        case 'SSSS':
            return parseTokenDigits;
        case 'MM':
        case 'DD':
        case 'YY':
        case 'GG':
        case 'gg':
        case 'HH':
        case 'hh':
        case 'mm':
        case 'ss':
        case 'ww':
        case 'WW':
            return strict ? parseTokenTwoDigits : parseTokenOneOrTwoDigits;
        case 'M':
        case 'D':
        case 'd':
        case 'H':
        case 'h':
        case 'm':
        case 's':
        case 'w':
        case 'W':
        case 'e':
        case 'E':
            return parseTokenOneOrTwoDigits;
        case 'Do':
            return parseTokenOrdinal;
        default :
            a = new RegExp(regexpEscape(unescapeFormat(token.replace('\\', '')), "i"));
            return a;
        }
    }

    function timezoneMinutesFromString(string) {
        string = string || "";
        var possibleTzMatches = (string.match(parseTokenTimezone) || []),
            tzChunk = possibleTzMatches[possibleTzMatches.length - 1] || [],
            parts = (tzChunk + '').match(parseTimezoneChunker) || ['-', 0, 0],
            minutes = +(parts[1] * 60) + toInt(parts[2]);

        return parts[0] === '+' ? -minutes : minutes;
    }

    // function to convert string input to date
    function addTimeToArrayFromToken(token, input, config) {
        var a, datePartArray = config._a;

        switch (token) {
        // QUARTER
        case 'Q':
            if (input != null) {
                datePartArray[MONTH] = (toInt(input) - 1) * 3;
            }
            break;
        // MONTH
        case 'M' : // fall through to MM
        case 'MM' :
            if (input != null) {
                datePartArray[MONTH] = toInt(input) - 1;
            }
            break;
        case 'MMM' : // fall through to MMMM
        case 'MMMM' :
            a = getLangDefinition(config._l).monthsParse(input);
            // if we didn't find a month name, mark the date as invalid.
            if (a != null) {
                datePartArray[MONTH] = a;
            } else {
                config._pf.invalidMonth = input;
            }
            break;
        // DAY OF MONTH
        case 'D' : // fall through to DD
        case 'DD' :
            if (input != null) {
                datePartArray[DATE] = toInt(input);
            }
            break;
        case 'Do' :
            if (input != null) {
                datePartArray[DATE] = toInt(parseInt(input, 10));
            }
            break;
        // DAY OF YEAR
        case 'DDD' : // fall through to DDDD
        case 'DDDD' :
            if (input != null) {
                config._dayOfYear = toInt(input);
            }

            break;
        // YEAR
        case 'YY' :
            datePartArray[YEAR] = moment.parseTwoDigitYear(input);
            break;
        case 'YYYY' :
        case 'YYYYY' :
        case 'YYYYYY' :
            datePartArray[YEAR] = toInt(input);
            break;
        // AM / PM
        case 'a' : // fall through to A
        case 'A' :
            config._isPm = getLangDefinition(config._l).isPM(input);
            break;
        // 24 HOUR
        case 'H' : // fall through to hh
        case 'HH' : // fall through to hh
        case 'h' : // fall through to hh
        case 'hh' :
            datePartArray[HOUR] = toInt(input);
            break;
        // MINUTE
        case 'm' : // fall through to mm
        case 'mm' :
            datePartArray[MINUTE] = toInt(input);
            break;
        // SECOND
        case 's' : // fall through to ss
        case 'ss' :
            datePartArray[SECOND] = toInt(input);
            break;
        // MILLISECOND
        case 'S' :
        case 'SS' :
        case 'SSS' :
        case 'SSSS' :
            datePartArray[MILLISECOND] = toInt(('0.' + input) * 1000);
            break;
        // UNIX TIMESTAMP WITH MS
        case 'X':
            config._d = new Date(parseFloat(input) * 1000);
            break;
        // TIMEZONE
        case 'Z' : // fall through to ZZ
        case 'ZZ' :
            config._useUTC = true;
            config._tzm = timezoneMinutesFromString(input);
            break;
        // WEEKDAY - human
        case 'dd':
        case 'ddd':
        case 'dddd':
            a = getLangDefinition(config._l).weekdaysParse(input);
            // if we didn't get a weekday name, mark the date as invalid
            if (a != null) {
                config._w = config._w || {};
                config._w['d'] = a;
            } else {
                config._pf.invalidWeekday = input;
            }
            break;
        // WEEK, WEEK DAY - numeric
        case 'w':
        case 'ww':
        case 'W':
        case 'WW':
        case 'd':
        case 'e':
        case 'E':
            token = token.substr(0, 1);
            /* falls through */
        case 'gggg':
        case 'GGGG':
        case 'GGGGG':
            token = token.substr(0, 2);
            if (input) {
                config._w = config._w || {};
                config._w[token] = toInt(input);
            }
            break;
        case 'gg':
        case 'GG':
            config._w = config._w || {};
            config._w[token] = moment.parseTwoDigitYear(input);
        }
    }

    function dayOfYearFromWeekInfo(config) {
        var w, weekYear, week, weekday, dow, doy, temp, lang;

        w = config._w;
        if (w.GG != null || w.W != null || w.E != null) {
            dow = 1;
            doy = 4;

            // TODO: We need to take the current isoWeekYear, but that depends on
            // how we interpret now (local, utc, fixed offset). So create
            // a now version of current config (take local/utc/offset flags, and
            // create now).
            weekYear = dfl(w.GG, config._a[YEAR], weekOfYear(moment(), 1, 4).year);
            week = dfl(w.W, 1);
            weekday = dfl(w.E, 1);
        } else {
            lang = getLangDefinition(config._l);
            dow = lang._week.dow;
            doy = lang._week.doy;

            weekYear = dfl(w.gg, config._a[YEAR], weekOfYear(moment(), dow, doy).year);
            week = dfl(w.w, 1);

            if (w.d != null) {
                // weekday -- low day numbers are considered next week
                weekday = w.d;
                if (weekday < dow) {
                    ++week;
                }
            } else if (w.e != null) {
                // local weekday -- counting starts from begining of week
                weekday = w.e + dow;
            } else {
                // default to begining of week
                weekday = dow;
            }
        }
        temp = dayOfYearFromWeeks(weekYear, week, weekday, doy, dow);

        config._a[YEAR] = temp.year;
        config._dayOfYear = temp.dayOfYear;
    }

    // convert an array to a date.
    // the array should mirror the parameters below
    // note: all values past the year are optional and will default to the lowest possible value.
    // [year, month, day , hour, minute, second, millisecond]
    function dateFromConfig(config) {
        var i, date, input = [], currentDate, yearToUse;

        if (config._d) {
            return;
        }

        currentDate = currentDateArray(config);

        //compute day of the year from weeks and weekdays
        if (config._w && config._a[DATE] == null && config._a[MONTH] == null) {
            dayOfYearFromWeekInfo(config);
        }

        //if the day of the year is set, figure out what it is
        if (config._dayOfYear) {
            yearToUse = dfl(config._a[YEAR], currentDate[YEAR]);

            if (config._dayOfYear > daysInYear(yearToUse)) {
                config._pf._overflowDayOfYear = true;
            }

            date = makeUTCDate(yearToUse, 0, config._dayOfYear);
            config._a[MONTH] = date.getUTCMonth();
            config._a[DATE] = date.getUTCDate();
        }

        // Default to current date.
        // * if no year, month, day of month are given, default to today
        // * if day of month is given, default month and year
        // * if month is given, default only year
        // * if year is given, don't default anything
        for (i = 0; i < 3 && config._a[i] == null; ++i) {
            config._a[i] = input[i] = currentDate[i];
        }

        // Zero out whatever was not defaulted, including time
        for (; i < 7; i++) {
            config._a[i] = input[i] = (config._a[i] == null) ? (i === 2 ? 1 : 0) : config._a[i];
        }

        config._d = (config._useUTC ? makeUTCDate : makeDate).apply(null, input);
        // Apply timezone offset from input. The actual zone can be changed
        // with parseZone.
        if (config._tzm != null) {
            config._d.setUTCMinutes(config._d.getUTCMinutes() + config._tzm);
        }
    }

    function dateFromObject(config) {
        var normalizedInput;

        if (config._d) {
            return;
        }

        normalizedInput = normalizeObjectUnits(config._i);
        config._a = [
            normalizedInput.year,
            normalizedInput.month,
            normalizedInput.day,
            normalizedInput.hour,
            normalizedInput.minute,
            normalizedInput.second,
            normalizedInput.millisecond
        ];

        dateFromConfig(config);
    }

    function currentDateArray(config) {
        var now = new Date();
        if (config._useUTC) {
            return [
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate()
            ];
        } else {
            return [now.getFullYear(), now.getMonth(), now.getDate()];
        }
    }

    // date from string and format string
    function makeDateFromStringAndFormat(config) {

        if (config._f === moment.ISO_8601) {
            parseISO(config);
            return;
        }

        config._a = [];
        config._pf.empty = true;

        // This array is used to make a Date, either with `new Date` or `Date.UTC`
        var lang = getLangDefinition(config._l),
            string = '' + config._i,
            i, parsedInput, tokens, token, skipped,
            stringLength = string.length,
            totalParsedInputLength = 0;

        tokens = expandFormat(config._f, lang).match(formattingTokens) || [];

        for (i = 0; i < tokens.length; i++) {
            token = tokens[i];
            parsedInput = (string.match(getParseRegexForToken(token, config)) || [])[0];
            if (parsedInput) {
                skipped = string.substr(0, string.indexOf(parsedInput));
                if (skipped.length > 0) {
                    config._pf.unusedInput.push(skipped);
                }
                string = string.slice(string.indexOf(parsedInput) + parsedInput.length);
                totalParsedInputLength += parsedInput.length;
            }
            // don't parse if it's not a known token
            if (formatTokenFunctions[token]) {
                if (parsedInput) {
                    config._pf.empty = false;
                }
                else {
                    config._pf.unusedTokens.push(token);
                }
                addTimeToArrayFromToken(token, parsedInput, config);
            }
            else if (config._strict && !parsedInput) {
                config._pf.unusedTokens.push(token);
            }
        }

        // add remaining unparsed input length to the string
        config._pf.charsLeftOver = stringLength - totalParsedInputLength;
        if (string.length > 0) {
            config._pf.unusedInput.push(string);
        }

        // handle am pm
        if (config._isPm && config._a[HOUR] < 12) {
            config._a[HOUR] += 12;
        }
        // if is 12 am, change hours to 0
        if (config._isPm === false && config._a[HOUR] === 12) {
            config._a[HOUR] = 0;
        }

        dateFromConfig(config);
        checkOverflow(config);
    }

    function unescapeFormat(s) {
        return s.replace(/\\(\[)|\\(\])|\[([^\]\[]*)\]|\\(.)/g, function (matched, p1, p2, p3, p4) {
            return p1 || p2 || p3 || p4;
        });
    }

    // Code from http://stackoverflow.com/questions/3561493/is-there-a-regexp-escape-function-in-javascript
    function regexpEscape(s) {
        return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    }

    // date from string and array of format strings
    function makeDateFromStringAndArray(config) {
        var tempConfig,
            bestMoment,

            scoreToBeat,
            i,
            currentScore;

        if (config._f.length === 0) {
            config._pf.invalidFormat = true;
            config._d = new Date(NaN);
            return;
        }

        for (i = 0; i < config._f.length; i++) {
            currentScore = 0;
            tempConfig = extend({}, config);
            tempConfig._pf = defaultParsingFlags();
            tempConfig._f = config._f[i];
            makeDateFromStringAndFormat(tempConfig);

            if (!isValid(tempConfig)) {
                continue;
            }

            // if there is any input that was not parsed add a penalty for that format
            currentScore += tempConfig._pf.charsLeftOver;

            //or tokens
            currentScore += tempConfig._pf.unusedTokens.length * 10;

            tempConfig._pf.score = currentScore;

            if (scoreToBeat == null || currentScore < scoreToBeat) {
                scoreToBeat = currentScore;
                bestMoment = tempConfig;
            }
        }

        extend(config, bestMoment || tempConfig);
    }

    // date from iso format
    function parseISO(config) {
        var i, l,
            string = config._i,
            match = isoRegex.exec(string);

        if (match) {
            config._pf.iso = true;
            for (i = 0, l = isoDates.length; i < l; i++) {
                if (isoDates[i][1].exec(string)) {
                    // match[5] should be "T" or undefined
                    config._f = isoDates[i][0] + (match[6] || " ");
                    break;
                }
            }
            for (i = 0, l = isoTimes.length; i < l; i++) {
                if (isoTimes[i][1].exec(string)) {
                    config._f += isoTimes[i][0];
                    break;
                }
            }
            if (string.match(parseTokenTimezone)) {
                config._f += "Z";
            }
            makeDateFromStringAndFormat(config);
        } else {
            config._isValid = false;
        }
    }

    // date from iso format or fallback
    function makeDateFromString(config) {
        parseISO(config);
        if (config._isValid === false) {
            delete config._isValid;
            moment.createFromInputFallback(config);
        }
    }

    function makeDateFromInput(config) {
        var input = config._i, matched;
        if (input === undefined) {
            config._d = new Date();
        } else if (isDate(input)) {
            config._d = new Date(+input);
        } else if ( (matched = aspNetJsonRegex.exec(input)) !== null ) {
            config._d = new Date(+matched[1]);
        } else if (typeof input === 'string') {
            makeDateFromString(config);
        } else if (isArray(input)) {
            config._a = input.slice(0);
            dateFromConfig(config);
        } else if (typeof(input) === 'object') {
            dateFromObject(config);
        } else if (typeof(input) === 'number') {
            // from milliseconds
            config._d = new Date(input);
        } else {
            moment.createFromInputFallback(config);
        }
    }

    function makeDate(y, m, d, h, M, s, ms) {
        //can't just apply() to create a date:
        //http://stackoverflow.com/questions/181348/instantiating-a-javascript-object-by-calling-prototype-constructor-apply
        var date = new Date(y, m, d, h, M, s, ms);

        //the date constructor doesn't accept years < 1970
        if (y < 1970) {
            date.setFullYear(y);
        }
        return date;
    }

    function makeUTCDate(y) {
        var date = new Date(Date.UTC.apply(null, arguments));
        if (y < 1970) {
            date.setUTCFullYear(y);
        }
        return date;
    }

    function parseWeekday(input, language) {
        if (typeof input === 'string') {
            if (!isNaN(input)) {
                input = parseInt(input, 10);
            }
            else {
                input = language.weekdaysParse(input);
                if (typeof input !== 'number') {
                    return null;
                }
            }
        }
        return input;
    }

    /************************************
        Relative Time
    ************************************/


    // helper function for moment.fn.from, moment.fn.fromNow, and moment.duration.fn.humanize
    function substituteTimeAgo(string, number, withoutSuffix, isFuture, lang) {
        return lang.relativeTime(number || 1, !!withoutSuffix, string, isFuture);
    }

    function relativeTime(posNegDuration, withoutSuffix, lang) {
        var duration = moment.duration(posNegDuration).abs(),
            seconds = round(duration.as('s')),
            minutes = round(duration.as('m')),
            hours = round(duration.as('h')),
            days = round(duration.as('d')),
            months = round(duration.as('M')),
            years = round(duration.as('y')),

            args = seconds < relativeTimeThresholds.s && ['s', seconds] ||
                minutes === 1 && ['m'] ||
                minutes < relativeTimeThresholds.m && ['mm', minutes] ||
                hours === 1 && ['h'] ||
                hours < relativeTimeThresholds.h && ['hh', hours] ||
                days === 1 && ['d'] ||
                days < relativeTimeThresholds.d && ['dd', days] ||
                months === 1 && ['M'] ||
                months < relativeTimeThresholds.M && ['MM', months] ||
                years === 1 && ['y'] || ['yy', years];

        args[2] = withoutSuffix;
        args[3] = +posNegDuration > 0;
        args[4] = lang;
        return substituteTimeAgo.apply({}, args);
    }


    /************************************
        Week of Year
    ************************************/


    // firstDayOfWeek       0 = sun, 6 = sat
    //                      the day of the week that starts the week
    //                      (usually sunday or monday)
    // firstDayOfWeekOfYear 0 = sun, 6 = sat
    //                      the first week is the week that contains the first
    //                      of this day of the week
    //                      (eg. ISO weeks use thursday (4))
    function weekOfYear(mom, firstDayOfWeek, firstDayOfWeekOfYear) {
        var end = firstDayOfWeekOfYear - firstDayOfWeek,
            daysToDayOfWeek = firstDayOfWeekOfYear - mom.day(),
            adjustedMoment;


        if (daysToDayOfWeek > end) {
            daysToDayOfWeek -= 7;
        }

        if (daysToDayOfWeek < end - 7) {
            daysToDayOfWeek += 7;
        }

        adjustedMoment = moment(mom).add('d', daysToDayOfWeek);
        return {
            week: Math.ceil(adjustedMoment.dayOfYear() / 7),
            year: adjustedMoment.year()
        };
    }

    //http://en.wikipedia.org/wiki/ISO_week_date#Calculating_a_date_given_the_year.2C_week_number_and_weekday
    function dayOfYearFromWeeks(year, week, weekday, firstDayOfWeekOfYear, firstDayOfWeek) {
        var d = makeUTCDate(year, 0, 1).getUTCDay(), daysToAdd, dayOfYear;

        d = d === 0 ? 7 : d;
        weekday = weekday != null ? weekday : firstDayOfWeek;
        daysToAdd = firstDayOfWeek - d + (d > firstDayOfWeekOfYear ? 7 : 0) - (d < firstDayOfWeek ? 7 : 0);
        dayOfYear = 7 * (week - 1) + (weekday - firstDayOfWeek) + daysToAdd + 1;

        return {
            year: dayOfYear > 0 ? year : year - 1,
            dayOfYear: dayOfYear > 0 ?  dayOfYear : daysInYear(year - 1) + dayOfYear
        };
    }

    /************************************
        Top Level Functions
    ************************************/

    function makeMoment(config) {
        var input = config._i,
            format = config._f;

        if (input === null || (format === undefined && input === '')) {
            return moment.invalid({nullInput: true});
        }

        if (typeof input === 'string') {
            config._i = input = getLangDefinition().preparse(input);
        }

        if (moment.isMoment(input)) {
            config = cloneMoment(input);

            config._d = new Date(+input._d);
        } else if (format) {
            if (isArray(format)) {
                makeDateFromStringAndArray(config);
            } else {
                makeDateFromStringAndFormat(config);
            }
        } else {
            makeDateFromInput(config);
        }

        return new Moment(config);
    }

    moment = function (input, format, lang, strict) {
        var c;

        if (typeof(lang) === "boolean") {
            strict = lang;
            lang = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c = {};
        c._isAMomentObject = true;
        c._i = input;
        c._f = format;
        c._l = lang;
        c._strict = strict;
        c._isUTC = false;
        c._pf = defaultParsingFlags();

        return makeMoment(c);
    };

    moment.suppressDeprecationWarnings = false;

    moment.createFromInputFallback = deprecate(
        "moment construction falls back to js Date. This is " +
        "discouraged and will be removed in upcoming major " +
        "release. Please refer to " +
        "https://github.com/moment/moment/issues/1407 for more info.",
        function (config) {
            config._d = new Date(config._i);
        }
    );

    // Pick a moment m from moments so that m[fn](other) is true for all
    // other. This relies on the function fn to be transitive.
    //
    // moments should either be an array of moment objects or an array, whose
    // first element is an array of moment objects.
    function pickBy(fn, moments) {
        var res, i;
        if (moments.length === 1 && isArray(moments[0])) {
            moments = moments[0];
        }
        if (!moments.length) {
            return moment();
        }
        res = moments[0];
        for (i = 1; i < moments.length; ++i) {
            if (moments[i][fn](res)) {
                res = moments[i];
            }
        }
        return res;
    }

    moment.min = function () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isBefore', args);
    };

    moment.max = function () {
        var args = [].slice.call(arguments, 0);

        return pickBy('isAfter', args);
    };

    // creating with utc
    moment.utc = function (input, format, lang, strict) {
        var c;

        if (typeof(lang) === "boolean") {
            strict = lang;
            lang = undefined;
        }
        // object construction must be done this way.
        // https://github.com/moment/moment/issues/1423
        c = {};
        c._isAMomentObject = true;
        c._useUTC = true;
        c._isUTC = true;
        c._l = lang;
        c._i = input;
        c._f = format;
        c._strict = strict;
        c._pf = defaultParsingFlags();

        return makeMoment(c).utc();
    };

    // creating with unix timestamp (in seconds)
    moment.unix = function (input) {
        return moment(input * 1000);
    };

    // duration
    moment.duration = function (input, key) {
        var duration = input,
            // matching against regexp is expensive, do it on demand
            match = null,
            sign,
            ret,
            parseIso,
            diffRes;

        if (moment.isDuration(input)) {
            duration = {
                ms: input._milliseconds,
                d: input._days,
                M: input._months
            };
        } else if (typeof input === 'number') {
            duration = {};
            if (key) {
                duration[key] = input;
            } else {
                duration.milliseconds = input;
            }
        } else if (!!(match = aspNetTimeSpanJsonRegex.exec(input))) {
            sign = (match[1] === "-") ? -1 : 1;
            duration = {
                y: 0,
                d: toInt(match[DATE]) * sign,
                h: toInt(match[HOUR]) * sign,
                m: toInt(match[MINUTE]) * sign,
                s: toInt(match[SECOND]) * sign,
                ms: toInt(match[MILLISECOND]) * sign
            };
        } else if (!!(match = isoDurationRegex.exec(input))) {
            sign = (match[1] === "-") ? -1 : 1;
            parseIso = function (inp) {
                // We'd normally use ~~inp for this, but unfortunately it also
                // converts floats to ints.
                // inp may be undefined, so careful calling replace on it.
                var res = inp && parseFloat(inp.replace(',', '.'));
                // apply sign while we're at it
                return (isNaN(res) ? 0 : res) * sign;
            };
            duration = {
                y: parseIso(match[2]),
                M: parseIso(match[3]),
                d: parseIso(match[4]),
                h: parseIso(match[5]),
                m: parseIso(match[6]),
                s: parseIso(match[7]),
                w: parseIso(match[8])
            };
        } else if (typeof duration === "object" &&
                ("from" in duration || "to" in duration)) {
            diffRes = momentsDifference(moment(duration.from), moment(duration.to));

            duration = {};
            duration.ms = diffRes.milliseconds;
            duration.M = diffRes.months;
        }

        ret = new Duration(duration);

        if (moment.isDuration(input) && input.hasOwnProperty('_lang')) {
            ret._lang = input._lang;
        }

        return ret;
    };

    // version number
    moment.version = VERSION;

    // default format
    moment.defaultFormat = isoFormat;

    // constant that refers to the ISO standard
    moment.ISO_8601 = function () {};

    // Plugins that add properties should also add the key here (null value),
    // so we can properly clone ourselves.
    moment.momentProperties = momentProperties;

    // This function will be called whenever a moment is mutated.
    // It is intended to keep the offset in sync with the timezone.
    moment.updateOffset = function () {};

    // This function allows you to set a threshold for relative time strings
    moment.relativeTimeThreshold = function (threshold, limit) {
        if (relativeTimeThresholds[threshold] === undefined) {
            return false;
        }
        if (limit === undefined) {
            return relativeTimeThresholds[threshold];
        }
        relativeTimeThresholds[threshold] = limit;
        return true;
    };

    // This function will load languages and then set the global language.  If
    // no arguments are passed in, it will simply return the current global
    // language key.
    moment.lang = function (key, values) {
        var r;
        if (!key) {
            return moment.fn._lang._abbr;
        }
        if (values) {
            loadLang(normalizeLanguage(key), values);
        } else if (values === null) {
            unloadLang(key);
            key = 'en';
        } else if (!languages[key]) {
            getLangDefinition(key);
        }
        r = moment.duration.fn._lang = moment.fn._lang = getLangDefinition(key);
        return r._abbr;
    };

    // returns language data
    moment.langData = function (key) {
        if (key && key._lang && key._lang._abbr) {
            key = key._lang._abbr;
        }
        return getLangDefinition(key);
    };

    // compare moment object
    moment.isMoment = function (obj) {
        return obj instanceof Moment ||
            (obj != null &&  obj.hasOwnProperty('_isAMomentObject'));
    };

    // for typechecking Duration objects
    moment.isDuration = function (obj) {
        return obj instanceof Duration;
    };

    for (i = lists.length - 1; i >= 0; --i) {
        makeList(lists[i]);
    }

    moment.normalizeUnits = function (units) {
        return normalizeUnits(units);
    };

    moment.invalid = function (flags) {
        var m = moment.utc(NaN);
        if (flags != null) {
            extend(m._pf, flags);
        }
        else {
            m._pf.userInvalidated = true;
        }

        return m;
    };

    moment.parseZone = function () {
        return moment.apply(null, arguments).parseZone();
    };

    moment.parseTwoDigitYear = function (input) {
        return toInt(input) + (toInt(input) > 68 ? 1900 : 2000);
    };

    /************************************
        Moment Prototype
    ************************************/


    extend(moment.fn = Moment.prototype, {

        clone : function () {
            return moment(this);
        },

        valueOf : function () {
            return +this._d + ((this._offset || 0) * 60000);
        },

        unix : function () {
            return Math.floor(+this / 1000);
        },

        toString : function () {
            return this.clone().lang('en').format("ddd MMM DD YYYY HH:mm:ss [GMT]ZZ");
        },

        toDate : function () {
            return this._offset ? new Date(+this) : this._d;
        },

        toISOString : function () {
            var m = moment(this).utc();
            if (0 < m.year() && m.year() <= 9999) {
                return formatMoment(m, 'YYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
            } else {
                return formatMoment(m, 'YYYYYY-MM-DD[T]HH:mm:ss.SSS[Z]');
            }
        },

        toArray : function () {
            var m = this;
            return [
                m.year(),
                m.month(),
                m.date(),
                m.hours(),
                m.minutes(),
                m.seconds(),
                m.milliseconds()
            ];
        },

        isValid : function () {
            return isValid(this);
        },

        isDSTShifted : function () {

            if (this._a) {
                return this.isValid() && compareArrays(this._a, (this._isUTC ? moment.utc(this._a) : moment(this._a)).toArray()) > 0;
            }

            return false;
        },

        parsingFlags : function () {
            return extend({}, this._pf);
        },

        invalidAt: function () {
            return this._pf.overflow;
        },

        utc : function (keepLocalTime) {
            return this.zone(0, keepLocalTime);
        },

        local : function (keepLocalTime) {
            if (this._isUTC) {
                this.zone(0, keepLocalTime);
                this._isUTC = false;

                if (keepLocalTime) {
                    this.add(this._d.getTimezoneOffset(), 'm');
                }
            }
            return this;
        },

        format : function (inputString) {
            var output = formatMoment(this, inputString || moment.defaultFormat);
            return this.lang().postformat(output);
        },

        add : function (input, val) {
            var dur;
            // switch args to support add('s', 1) and add(1, 's')
            if (typeof input === 'string' && typeof val === 'string') {
                dur = moment.duration(isNaN(+val) ? +input : +val, isNaN(+val) ? val : input);
            } else if (typeof input === 'string') {
                dur = moment.duration(+val, input);
            } else {
                dur = moment.duration(input, val);
            }
            addOrSubtractDurationFromMoment(this, dur, 1);
            return this;
        },

        subtract : function (input, val) {
            var dur;
            // switch args to support subtract('s', 1) and subtract(1, 's')
            if (typeof input === 'string' && typeof val === 'string') {
                dur = moment.duration(isNaN(+val) ? +input : +val, isNaN(+val) ? val : input);
            } else if (typeof input === 'string') {
                dur = moment.duration(+val, input);
            } else {
                dur = moment.duration(input, val);
            }
            addOrSubtractDurationFromMoment(this, dur, -1);
            return this;
        },

        diff : function (input, units, asFloat) {
            var that = makeAs(input, this),
                zoneDiff = (this.zone() - that.zone()) * 6e4,
                diff, output;

            units = normalizeUnits(units);

            if (units === 'year' || units === 'month') {
                // average number of days in the months in the given dates
                diff = (this.daysInMonth() + that.daysInMonth()) * 432e5; // 24 * 60 * 60 * 1000 / 2
                // difference in months
                output = ((this.year() - that.year()) * 12) + (this.month() - that.month());
                // adjust by taking difference in days, average number of days
                // and dst in the given months.
                output += ((this - moment(this).startOf('month')) -
                        (that - moment(that).startOf('month'))) / diff;
                // same as above but with zones, to negate all dst
                output -= ((this.zone() - moment(this).startOf('month').zone()) -
                        (that.zone() - moment(that).startOf('month').zone())) * 6e4 / diff;
                if (units === 'year') {
                    output = output / 12;
                }
            } else {
                diff = (this - that);
                output = units === 'second' ? diff / 1e3 : // 1000
                    units === 'minute' ? diff / 6e4 : // 1000 * 60
                    units === 'hour' ? diff / 36e5 : // 1000 * 60 * 60
                    units === 'day' ? (diff - zoneDiff) / 864e5 : // 1000 * 60 * 60 * 24, negate dst
                    units === 'week' ? (diff - zoneDiff) / 6048e5 : // 1000 * 60 * 60 * 24 * 7, negate dst
                    diff;
            }
            return asFloat ? output : absRound(output);
        },

        from : function (time, withoutSuffix) {
            return moment.duration({to: this, from: time}).lang(this.lang()._abbr).humanize(!withoutSuffix);
        },

        fromNow : function (withoutSuffix) {
            return this.from(moment(), withoutSuffix);
        },

        calendar : function (time) {
            // We want to compare the start of today, vs this.
            // Getting start-of-today depends on whether we're zone'd or not.
            var now = time || moment(),
                sod = makeAs(now, this).startOf('day'),
                diff = this.diff(sod, 'days', true),
                format = diff < -6 ? 'sameElse' :
                    diff < -1 ? 'lastWeek' :
                    diff < 0 ? 'lastDay' :
                    diff < 1 ? 'sameDay' :
                    diff < 2 ? 'nextDay' :
                    diff < 7 ? 'nextWeek' : 'sameElse';
            return this.format(this.lang().calendar(format, this));
        },

        isLeapYear : function () {
            return isLeapYear(this.year());
        },

        isDST : function () {
            return (this.zone() < this.clone().month(0).zone() ||
                this.zone() < this.clone().month(5).zone());
        },

        day : function (input) {
            var day = this._isUTC ? this._d.getUTCDay() : this._d.getDay();
            if (input != null) {
                input = parseWeekday(input, this.lang());
                return this.add(input - day, 'days');
            } else {
                return day;
            }
        },

        month : makeAccessor('Month', true),

        startOf: function (units) {
            units = normalizeUnits(units);
            // the following switch intentionally omits break keywords
            // to utilize falling through the cases.
            switch (units) {
            case 'year':
                this.month(0);
                /* falls through */
            case 'quarter':
            case 'month':
                this.date(1);
                /* falls through */
            case 'week':
            case 'isoWeek':
            case 'day':
                this.hours(0);
                /* falls through */
            case 'hour':
                this.minutes(0);
                /* falls through */
            case 'minute':
                this.seconds(0);
                /* falls through */
            case 'second':
                this.milliseconds(0);
                /* falls through */
            }

            // weeks are a special case
            if (units === 'week') {
                this.weekday(0);
            } else if (units === 'isoWeek') {
                this.isoWeekday(1);
            }

            // quarters are also special
            if (units === 'quarter') {
                this.month(Math.floor(this.month() / 3) * 3);
            }

            return this;
        },

        endOf: function (units) {
            units = normalizeUnits(units);
            return this.startOf(units).add((units === 'isoWeek' ? 'week' : units), 1).subtract('ms', 1);
        },

        isAfter: function (input, units) {
            units = typeof units !== 'undefined' ? units : 'millisecond';
            return +this.clone().startOf(units) > +moment(input).startOf(units);
        },

        isBefore: function (input, units) {
            units = typeof units !== 'undefined' ? units : 'millisecond';
            return +this.clone().startOf(units) < +moment(input).startOf(units);
        },

        isSame: function (input, units) {
            units = units || 'ms';
            return +this.clone().startOf(units) === +makeAs(input, this).startOf(units);
        },

        min: deprecate(
                 "moment().min is deprecated, use moment.min instead. https://github.com/moment/moment/issues/1548",
                 function (other) {
                     other = moment.apply(null, arguments);
                     return other < this ? this : other;
                 }
         ),

        max: deprecate(
                "moment().max is deprecated, use moment.max instead. https://github.com/moment/moment/issues/1548",
                function (other) {
                    other = moment.apply(null, arguments);
                    return other > this ? this : other;
                }
        ),

        // keepLocalTime = true means only change the timezone, without
        // affecting the local hour. So 5:31:26 +0300 --[zone(2, true)]-->
        // 5:31:26 +0200 It is possible that 5:31:26 doesn't exist int zone
        // +0200, so we adjust the time as needed, to be valid.
        //
        // Keeping the time actually adds/subtracts (one hour)
        // from the actual represented time. That is why we call updateOffset
        // a second time. In case it wants us to change the offset again
        // _changeInProgress == true case, then we have to adjust, because
        // there is no such time in the given timezone.
        zone : function (input, keepLocalTime) {
            var offset = this._offset || 0,
                localAdjust;
            if (input != null) {
                if (typeof input === "string") {
                    input = timezoneMinutesFromString(input);
                }
                if (Math.abs(input) < 16) {
                    input = input * 60;
                }
                if (!this._isUTC && keepLocalTime) {
                    localAdjust = this._d.getTimezoneOffset();
                }
                this._offset = input;
                this._isUTC = true;
                if (localAdjust != null) {
                    this.subtract(localAdjust, 'm');
                }
                if (offset !== input) {
                    if (!keepLocalTime || this._changeInProgress) {
                        addOrSubtractDurationFromMoment(this,
                                moment.duration(offset - input, 'm'), 1, false);
                    } else if (!this._changeInProgress) {
                        this._changeInProgress = true;
                        moment.updateOffset(this, true);
                        this._changeInProgress = null;
                    }
                }
            } else {
                return this._isUTC ? offset : this._d.getTimezoneOffset();
            }
            return this;
        },

        zoneAbbr : function () {
            return this._isUTC ? "UTC" : "";
        },

        zoneName : function () {
            return this._isUTC ? "Coordinated Universal Time" : "";
        },

        parseZone : function () {
            if (this._tzm) {
                this.zone(this._tzm);
            } else if (typeof this._i === 'string') {
                this.zone(this._i);
            }
            return this;
        },

        hasAlignedHourOffset : function (input) {
            if (!input) {
                input = 0;
            }
            else {
                input = moment(input).zone();
            }

            return (this.zone() - input) % 60 === 0;
        },

        daysInMonth : function () {
            return daysInMonth(this.year(), this.month());
        },

        dayOfYear : function (input) {
            var dayOfYear = round((moment(this).startOf('day') - moment(this).startOf('year')) / 864e5) + 1;
            return input == null ? dayOfYear : this.add("d", (input - dayOfYear));
        },

        quarter : function (input) {
            return input == null ? Math.ceil((this.month() + 1) / 3) : this.month((input - 1) * 3 + this.month() % 3);
        },

        weekYear : function (input) {
            var year = weekOfYear(this, this.lang()._week.dow, this.lang()._week.doy).year;
            return input == null ? year : this.add("y", (input - year));
        },

        isoWeekYear : function (input) {
            var year = weekOfYear(this, 1, 4).year;
            return input == null ? year : this.add("y", (input - year));
        },

        week : function (input) {
            var week = this.lang().week(this);
            return input == null ? week : this.add("d", (input - week) * 7);
        },

        isoWeek : function (input) {
            var week = weekOfYear(this, 1, 4).week;
            return input == null ? week : this.add("d", (input - week) * 7);
        },

        weekday : function (input) {
            var weekday = (this.day() + 7 - this.lang()._week.dow) % 7;
            return input == null ? weekday : this.add("d", input - weekday);
        },

        isoWeekday : function (input) {
            // behaves the same as moment#day except
            // as a getter, returns 7 instead of 0 (1-7 range instead of 0-6)
            // as a setter, sunday should belong to the previous week.
            return input == null ? this.day() || 7 : this.day(this.day() % 7 ? input : input - 7);
        },

        isoWeeksInYear : function () {
            return weeksInYear(this.year(), 1, 4);
        },

        weeksInYear : function () {
            var weekInfo = this._lang._week;
            return weeksInYear(this.year(), weekInfo.dow, weekInfo.doy);
        },

        get : function (units) {
            units = normalizeUnits(units);
            return this[units]();
        },

        set : function (units, value) {
            units = normalizeUnits(units);
            if (typeof this[units] === 'function') {
                this[units](value);
            }
            return this;
        },

        // If passed a language key, it will set the language for this
        // instance.  Otherwise, it will return the language configuration
        // variables for this instance.
        lang : function (key) {
            if (key === undefined) {
                return this._lang;
            } else {
                this._lang = getLangDefinition(key);
                return this;
            }
        }
    });

    function rawMonthSetter(mom, value) {
        var dayOfMonth;

        // TODO: Move this out of here!
        if (typeof value === 'string') {
            value = mom.lang().monthsParse(value);
            // TODO: Another silent failure?
            if (typeof value !== 'number') {
                return mom;
            }
        }

        dayOfMonth = Math.min(mom.date(),
                daysInMonth(mom.year(), value));
        mom._d['set' + (mom._isUTC ? 'UTC' : '') + 'Month'](value, dayOfMonth);
        return mom;
    }

    function rawGetter(mom, unit) {
        return mom._d['get' + (mom._isUTC ? 'UTC' : '') + unit]();
    }

    function rawSetter(mom, unit, value) {
        if (unit === 'Month') {
            return rawMonthSetter(mom, value);
        } else {
            return mom._d['set' + (mom._isUTC ? 'UTC' : '') + unit](value);
        }
    }

    function makeAccessor(unit, keepTime) {
        return function (value) {
            if (value != null) {
                rawSetter(this, unit, value);
                moment.updateOffset(this, keepTime);
                return this;
            } else {
                return rawGetter(this, unit);
            }
        };
    }

    moment.fn.millisecond = moment.fn.milliseconds = makeAccessor('Milliseconds', false);
    moment.fn.second = moment.fn.seconds = makeAccessor('Seconds', false);
    moment.fn.minute = moment.fn.minutes = makeAccessor('Minutes', false);
    // Setting the hour should keep the time, because the user explicitly
    // specified which hour he wants. So trying to maintain the same hour (in
    // a new timezone) makes sense. Adding/subtracting hours does not follow
    // this rule.
    moment.fn.hour = moment.fn.hours = makeAccessor('Hours', true);
    // moment.fn.month is defined separately
    moment.fn.date = makeAccessor('Date', true);
    moment.fn.dates = deprecate("dates accessor is deprecated. Use date instead.", makeAccessor('Date', true));
    moment.fn.year = makeAccessor('FullYear', true);
    moment.fn.years = deprecate("years accessor is deprecated. Use year instead.", makeAccessor('FullYear', true));

    // add plural methods
    moment.fn.days = moment.fn.day;
    moment.fn.months = moment.fn.month;
    moment.fn.weeks = moment.fn.week;
    moment.fn.isoWeeks = moment.fn.isoWeek;
    moment.fn.quarters = moment.fn.quarter;

    // add aliased format methods
    moment.fn.toJSON = moment.fn.toISOString;

    /************************************
        Duration Prototype
    ************************************/


    function daysToYears (days) {
        // 400 years have 146097 days (taking into account leap year rules)
        return days * 400 / 146097;
    }

    function yearsToDays (years) {
        // years * 365 + absRound(years / 4) -
        //     absRound(years / 100) + absRound(years / 400);
        return years * 146097 / 400;
    }

    extend(moment.duration.fn = Duration.prototype, {

        _bubble : function () {
            var milliseconds = this._milliseconds,
                days = this._days,
                months = this._months,
                data = this._data,
                seconds, minutes, hours, years = 0;

            // The following code bubbles up values, see the tests for
            // examples of what that means.
            data.milliseconds = milliseconds % 1000;

            seconds = absRound(milliseconds / 1000);
            data.seconds = seconds % 60;

            minutes = absRound(seconds / 60);
            data.minutes = minutes % 60;

            hours = absRound(minutes / 60);
            data.hours = hours % 24;

            days += absRound(hours / 24);

            // Accurately convert days to years, assume start from year 0.
            years = absRound(daysToYears(days));
            days -= absRound(yearsToDays(years));

            // 30 days to a month
            // TODO (iskren): Use anchor date (like 1st Jan) to compute this.
            months += absRound(days / 30);
            days %= 30;

            // 12 months -> 1 year
            years += absRound(months / 12);
            months %= 12;

            data.days = days;
            data.months = months;
            data.years = years;
        },

        abs : function () {
            this._milliseconds = Math.abs(this._milliseconds);
            this._days = Math.abs(this._days);
            this._months = Math.abs(this._months);

            this._data.milliseconds = Math.abs(this._data.milliseconds);
            this._data.seconds = Math.abs(this._data.seconds);
            this._data.minutes = Math.abs(this._data.minutes);
            this._data.hours = Math.abs(this._data.hours);
            this._data.months = Math.abs(this._data.months);
            this._data.years = Math.abs(this._data.years);

            return this;
        },

        weeks : function () {
            return absRound(this.days() / 7);
        },

        valueOf : function () {
            return this._milliseconds +
              this._days * 864e5 +
              (this._months % 12) * 2592e6 +
              toInt(this._months / 12) * 31536e6;
        },

        humanize : function (withSuffix) {
            var output = relativeTime(this, !withSuffix, this.lang());

            if (withSuffix) {
                output = this.lang().pastFuture(+this, output);
            }

            return this.lang().postformat(output);
        },

        add : function (input, val) {
            // supports only 2.0-style add(1, 's') or add(moment)
            var dur = moment.duration(input, val);

            this._milliseconds += dur._milliseconds;
            this._days += dur._days;
            this._months += dur._months;

            this._bubble();

            return this;
        },

        subtract : function (input, val) {
            var dur = moment.duration(input, val);

            this._milliseconds -= dur._milliseconds;
            this._days -= dur._days;
            this._months -= dur._months;

            this._bubble();

            return this;
        },

        get : function (units) {
            units = normalizeUnits(units);
            return this[units.toLowerCase() + 's']();
        },

        as : function (units) {
            var days, months;
            units = normalizeUnits(units);

            days = this._days + this._milliseconds / 864e5;
            if (units === 'month' || units === 'year') {
                months = this._months + daysToYears(days) * 12;
                return units === 'month' ? months : months / 12;
            } else {
                days += yearsToDays(this._months / 12);
                switch (units) {
                    case 'week': return days / 7;
                    case 'day': return days;
                    case 'hour': return days * 24;
                    case 'minute': return days * 24 * 60;
                    case 'second': return days * 24 * 60 * 60;
                    case 'millisecond': return days * 24 * 60 * 60 * 1000;
                    default: throw new Error("Unknown unit " + units);
                }
            }
        },

        lang : moment.fn.lang,

        toIsoString : function () {
            // inspired by https://github.com/dordille/moment-isoduration/blob/master/moment.isoduration.js
            var years = Math.abs(this.years()),
                months = Math.abs(this.months()),
                days = Math.abs(this.days()),
                hours = Math.abs(this.hours()),
                minutes = Math.abs(this.minutes()),
                seconds = Math.abs(this.seconds() + this.milliseconds() / 1000);

            if (!this.asSeconds()) {
                // this is the same as C#'s (Noda) and python (isodate)...
                // but not other JS (goog.date)
                return 'P0D';
            }

            return (this.asSeconds() < 0 ? '-' : '') +
                'P' +
                (years ? years + 'Y' : '') +
                (months ? months + 'M' : '') +
                (days ? days + 'D' : '') +
                ((hours || minutes || seconds) ? 'T' : '') +
                (hours ? hours + 'H' : '') +
                (minutes ? minutes + 'M' : '') +
                (seconds ? seconds + 'S' : '');
        }
    });

    function makeDurationGetter(name) {
        moment.duration.fn[name] = function () {
            return this._data[name];
        };
    }

    for (i in unitMillisecondFactors) {
        if (unitMillisecondFactors.hasOwnProperty(i)) {
            makeDurationGetter(i.toLowerCase());
        }
    }

    moment.duration.fn.asMilliseconds = function () {
        return this.as('ms');
    };
    moment.duration.fn.asSeconds = function () {
        return this.as('s');
    };
    moment.duration.fn.asMinutes = function () {
        return this.as('m');
    };
    moment.duration.fn.asHours = function () {
        return this.as('h');
    };
    moment.duration.fn.asDays = function () {
        return this.as('d');
    };
    moment.duration.fn.asWeeks = function () {
        return this.as('weeks');
    };
    moment.duration.fn.asMonths = function () {
        return this.as('M');
    };
    moment.duration.fn.asYears = function () {
        return this.as('y');
    };

    /************************************
        Default Lang
    ************************************/


    // Set default language, other languages will inherit from English.
    moment.lang('en', {
        ordinal : function (number) {
            var b = number % 10,
                output = (toInt(number % 100 / 10) === 1) ? 'th' :
                (b === 1) ? 'st' :
                (b === 2) ? 'nd' :
                (b === 3) ? 'rd' : 'th';
            return number + output;
        }
    });

    /* EMBED_LANGUAGES */

    /************************************
        Exposing Moment
    ************************************/

    function makeGlobal(shouldDeprecate) {
        /*global ender:false */
        if (typeof ender !== 'undefined') {
            return;
        }
        oldGlobalMoment = globalScope.moment;
        if (shouldDeprecate) {
            globalScope.moment = deprecate(
                    "Accessing Moment through the global scope is " +
                    "deprecated, and will be removed in an upcoming " +
                    "release.",
                    moment);
        } else {
            globalScope.moment = moment;
        }
    }

    // CommonJS module is defined
    if (hasModule) {
        module.exports = moment;
    } else if (typeof define === "function" && define.amd) {
        define("moment", function (require, exports, module) {
            if (module.config && module.config() && module.config().noGlobal === true) {
                // release the global variable
                globalScope.moment = oldGlobalMoment;
            }

            return moment;
        });
        makeGlobal(true);
    } else {
        makeGlobal();
    }
}).call(this);;/* ng-infinite-scroll - v1.0.3 - 2013-10-07 */
// https://raw.github.com/platypus-creation/ngInfiniteScroll/

var mod = angular.module('infinite-scroll', []);

mod.directive('infiniteScroll', [
  '$rootScope', '$window', '$timeout', function($rootScope, $window, $timeout) {
    return {
      link: function(scope, elem, attrs) {
        $timeout(function() {
          $window = angular.element($window);
          var $scrollParent, checkWhenEnabled, elementTop, handler, scrollDistance, scrollEnabled, parentTop;

          $scrollParent = elem.parents().filter(function() {
            return /(auto|scroll)/.test($.css(this, 'overflow') + $.css(this, 'overflow-y'));
          }).eq(0);

          if ($scrollParent.length === 0) {
            $scrollParent = $window;
          }

          if (attrs.infiniteScrollSelf != null) {
              $scrollParent = elem;
          }

          scrollDistance = 0;
          if (attrs.infiniteScrollDistance != null) {
            scope.$watch(attrs.infiniteScrollDistance, function(value) {
              return scrollDistance = parseFloat(value, 10);
            });
          }
          scrollEnabled = true;
          checkWhenEnabled = false;
          if (attrs.infiniteScrollDisabled != null) {
            scope.$watch(attrs.infiniteScrollDisabled, function(value) {
              scrollEnabled = !value;
              if (scrollEnabled && checkWhenEnabled) {
                checkWhenEnabled = false;
                return handler();
              }
            });
          }
          parentTop = $scrollParent !== $window ? $scrollParent.position().top : 0;
          elementTop = elem.position().top - parentTop;
          handler = function() {
            var elementBottom, remaining, scrollBottom, shouldScroll;

            if(elem == $scrollParent) {
                remaining = elem[0].scrollHeight - elem.scrollTop() - elem.height();
                shouldScroll = remaining <= (elem[0].scrollHeight * scrollDistance);
            } else {
                elementBottom = elementTop + elem.height();
                scrollBottom = $scrollParent.height() + $scrollParent.scrollTop();
                remaining = elementBottom - scrollBottom;
                shouldScroll = remaining <= ($scrollParent.height() * scrollDistance);
            }
            if (shouldScroll && scrollEnabled) {
              if ($rootScope.$$phase) {
                return scope.$eval(attrs.infiniteScroll);
              } else {
                return scope.$apply(attrs.infiniteScroll);
              }
            } else if (shouldScroll) {
              return checkWhenEnabled = true;
            }
          };

          // if there isn't enough content to show a scrollbar
          // var interval = setInterval(function(){
          //     if($scrollParent[0].offsetHeight === $scrollParent[0].scrollHeight) {
          //         // load more
          //         scope.$apply(attrs.infiniteScroll)
          //     }
          // }, 1000)
          $scrollParent.on('scroll', handler);

          scope.$on('$destroy', function() {
              // clearInterval(interval);
              return $scrollParent.off('scroll', handler);
          });
          return $timeout((function() {
            if (attrs.infiniteScrollImmediateCheck) {
              if (scope.$eval(attrs.infiniteScrollImmediateCheck)) {
                return handler();
              }
            } else {
              return handler();
            }
          }), 0);
        }, 0);
      }
    };
  }
]);;(function() {
    'use strict';

    // add indexOf to old browsers
    if (!Array.prototype.indexOf) {
      Array.prototype.indexOf = function(elt /*, from*/)
      {
        var len = this.length >>> 0;

        var from = Number(arguments[1]) || 0;
        from = (from < 0) ? Math.ceil(from) : Math.floor(from);
        if (from < 0) {
          from += len;
        }

        for (; from < len; from++)
        {
          if (from in this &&
              this[from] === elt)
            return from;
        }
        return -1;
      };
    }

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/filter
    if (!Array.prototype.filter)
    {
      Array.prototype.filter = function(fun /*, thisArg */)
      {
        if (this === void 0 || this === null)
          throw new TypeError();

        var t = Object(this);
        var len = t.length >>> 0;
        if (typeof fun != "function")
          throw new TypeError();

        var res = [];
        var thisArg = arguments.length >= 2 ? arguments[1] : void 0;
        for (var i = 0; i < len; i++)
        {
          if (i in t)
          {
            var val = t[i];

            // NOTE: Technically this should Object.defineProperty at
            //       the next index, as push can be affected by
            //       properties on Object.prototype and Array.prototype.
            //       But that method's new, and collisions should be
            //       rare, so use the more-compatible alternative.
            if (fun.call(thisArg, val, i, t))
              res.push(val);
          }
        }

        return res;
      };
    }

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/map
    // Production steps of ECMA-262, Edition 5, 15.4.4.19
    // Reference: http://es5.github.io/#x15.4.4.19
    if (!Array.prototype.map) {

      Array.prototype.map = function(callback, thisArg) {

        var T, A, k;

        if (this === null) {
          throw new TypeError(" this is null or not defined");
        }

        // 1. Let O be the result of calling ToObject passing the |this|
        //    value as the argument.
        var O = Object(this);

        // 2. Let lenValue be the result of calling the Get internal
        //    method of O with the argument "length".
        // 3. Let len be ToUint32(lenValue).
        var len = O.length >>> 0;

        // 4. If IsCallable(callback) is false, throw a TypeError exception.
        // See: http://es5.github.com/#x9.11
        if (typeof callback !== "function") {
          throw new TypeError(callback + " is not a function");
        }

        // 5. If thisArg was supplied, let T be thisArg; else let T be undefined.
        if (arguments.length > 1) {
          T = thisArg;
        }

        // 6. Let A be a new array created as if by the expression new Array(len)
        //    where Array is the standard built-in constructor with that name and
        //    len is the value of len.
        A = new Array(len);

        // 7. Let k be 0
        k = 0;

        // 8. Repeat, while k < len
        while (k < len) {

          var kValue, mappedValue;

          // a. Let Pk be ToString(k).
          //   This is implicit for LHS operands of the in operator
          // b. Let kPresent be the result of calling the HasProperty internal
          //    method of O with argument Pk.
          //   This step can be combined with c
          // c. If kPresent is true, then
          if (k in O) {

            // i. Let kValue be the result of calling the Get internal
            //    method of O with argument Pk.
            kValue = O[k];

            // ii. Let mappedValue be the result of calling the Call internal
            //     method of callback with T as the this value and argument
            //     list containing kValue, k, and O.
            mappedValue = callback.call(T, kValue, k, O);

            // iii. Call the DefineOwnProperty internal method of A with arguments
            // Pk, Property Descriptor
            // { Value: mappedValue,
            //   Writable: true,
            //   Enumerable: true,
            //   Configurable: true },
            // and false.

            // In browsers that support Object.defineProperty, use the following:
            // Object.defineProperty(A, k, {
            //   value: mappedValue,
            //   writable: true,
            //   enumerable: true,
            //   configurable: true
            // });

            // For best browser support, use the following:
            A[k] = mappedValue;
          }
          // d. Increase k by 1.
          k++;
        }

        // 9. return A
        return A;
      };
    }

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/Trim
    if (!String.prototype.trim) {
      String.prototype.trim = function () {
        return this.replace(/^\s+|\s+$/g, '');
      };
    }

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/keys
    if (!Object.keys) {
        Object.keys = (function () {
            var hasOwnProperty = Object.prototype.hasOwnProperty,
                hasDontEnumBug = !({toString: null}).propertyIsEnumerable('toString'),
                dontEnums = [
                    'toString',
                    'toLocaleString',
                    'valueOf',
                    'hasOwnProperty',
                    'isPrototypeOf',
                    'propertyIsEnumerable',
                    'constructor'
                ],
                dontEnumsLength = dontEnums.length;

            return function (obj) {
                if (typeof obj !== 'object' && (typeof obj !== 'function' || obj === null)) {
                    throw new TypeError('Object.keys called on non-object');
                }

                var result = [], prop, i;

                for (prop in obj) {
                    if (hasOwnProperty.call(obj, prop)) {
                        result.push(prop);
                    }
                }

                if (hasDontEnumBug) {
                    for (i = 0; i < dontEnumsLength; i++) {
                        if (hasOwnProperty.call(obj, dontEnums[i])) {
                            result.push(dontEnums[i]);
                        }
                    }
                }
                return result;
            };
        }());
    }

    // slightly adapted from
    // https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/String/startsWith
    // removed Object.defineProperty reference as it is not IE8 compatible
    if (!String.prototype.startsWith) {
      String.prototype.startsWith = function(searchString, position) {
        position = position || 0;
        return this.lastIndexOf(searchString, position) === position;
      };
    }

    // slightly adapted from 
    // https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/String/endsWith
    // removed Object.defineProperty reference as it is not IE8 compatible
    if (!String.prototype.endsWith) {
      String.prototype.endsWith = function(searchString, position) {
        var subjectString = this.toString();
        if (position === undefined || position > subjectString.length) {
          position = subjectString.length;
        }
        position -= searchString.length;
        var lastIndex = subjectString.indexOf(searchString, position);
        return lastIndex !== -1 && lastIndex === position;
      };
    }

    // IE8 doesn't define hasOwnProperty on the window object
    if (!window.hasOwnProperty) {
        /*jshint -W001 */
        window.hasOwnProperty = function(name) {
            return Object.prototype.hasOwnProperty.call(window, name);
        };
        /*jshint +W001 */
    }

    // not really a polyfill but still a useful function to visually select the content of an html element
    window.selectText = function (element) {
        var doc = document,
            range,
            selection;
        if (doc.body.createTextRange) {
            range = document.body.createTextRange();
            range.moveToElementText(element);
            range.select();
        } else if (window.getSelection) {
            selection = window.getSelection();
            range = document.createRange();
            range.selectNodeContents(element);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    };

    window.isObjectEmpty = function(obj) {
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                return false;
            }
        }
        return true;
    }

    window.utf8_to_b64 = function(str) {
        // we escape the unicode string before encoding it in base64 becase btoa does not support unicode characters
        return window.btoa(jsesc(str, {
            'json': true
        }));
    };

    window.b64_to_utf8 = function(str) {
        return window.atob(str);
    };
}());;(function() {
    'use strict';

    // ODS-Widgets, a library of web components to build interactive visualizations from APIs
    // by OpenDataSoft
    //  License: MIT
    var version = '1.0.3';
    //  Homepage: https://github.com/opendatasoft/ods-widgets

    var mod = angular.module('ods-widgets', ['infinite-scroll', 'ngSanitize', 'gettext']);

    mod.provider('ODSWidgetsConfig', function() {
        /**
         * @ngdoc object
         * @name ods-widgets.ODSWidgetsConfigProvider
         * @description
         * Use `ODSWidgetsConfigProvider` to set configuration values used by various directives.
         * The available settings are:
         *
         * - **`defaultDomain`** - {@type string} - Value used as `domain` parameter for {@link ods-widgets.directive:odsCatalogContext Catalog Contexts}
         * and {@link ods-widgets.directive:odsDatasetContext Dataset Contexts} when none is specified. Defaults is '' (empty string), which means a local API (root is /).
         * - **`basemaps`** - {@type Array} A list of `basemap` objects.
         * - **`chartColors`** - {@type Array} A list of colors to use for charts. In each chart widget, the first chart will use the first color, the second chart
         * will use the second color, and so on until the end of the list is reached, and we start from the beginning of the list again. If not set, default colors will be used,
         * depending on the widgets themselves.
         * - **`disqusShortname`** - {@type string} - Shortname used by default for all {@link ods-widgets.directive:odsDisqus} widgets.
         * - **`themes`** - {@type Object} - Configuration of themes and their colors and/or picto
         *
         * @example
         * <pre>
         *   var app = angular.module('ods-widgets').config(function(ODSWidgetsConfigProvider) {
         *       ODSWidgetsConfig.setConfig({
         *           defaultDomain: '/myapi'
         *       });
         *   });
         * </pre>
         */
        /**
         * @ngdoc service
         * @name ods-widgets.ODSWidgetsConfig
         * @description
         * A service containing all the configuration values available. Available configuration values are described
         * in the {@link ods-widgets.ODSWidgetsConfigProvider ODSWidgetsConfigProvider} documentation.
         */
        this.defaultConfig = {
            ODSWidgetsVersion: version,
            defaultDomain: '', // Defaults to local API
            language: null,
            disqusShortname: null,
            customAPIHeaders: null,
            basemaps: [
                {
                    "provider": "mapquest",
                    "label": "MapQuest"
                }
            ],
            mapGeobox: false,
            chartColors: null,
            mapPrependAttribution: null,
            basePath: null,
            websiteName: null,
            themes: {},
            defaultMapLocation: "12,48.85218,2.36996" // Paris
        };

        this.customConfig = {};

        this.setConfig = function(customConfig) {
            /**
             * @ngdoc method
             * @name ods-widgets.ODSWidgetsConfigProvider#setConfig
             * @methodOf ods-widgets.ODSWidgetsConfigProvider
             *
             * @description Sets configuration values by overriding existing values with the values from a new configuration
             * object. Existing values that are not present in the new object are left untouched.
             *
             * @param {Object=} customConfig An object containing the configuration values to override.
             */
            angular.extend(this.customConfig, customConfig);
        };

        this.$get = function() {
            return angular.extend({}, this.defaultConfig, this.customConfig);
        };
    });

    mod.run(['gettextCatalog', 'ODSWidgetsConfig', function(gettextCatalog, ODSWidgetsConfig) {
        // Initialize with an empty config so that at least it doesn't crash if
        // nobody bothers to add a translation dictionary.
        //gettextCatalog.setStrings({});

        if (!ODSWidgetsConfig.basePath) {
            // Try to detect the path where ODS-Widgets is loaded from
            // Kudos to Leaflet for the idea
            var scriptTags = document.getElementsByTagName('script');

            var odswidgetsRE = /[\/^]ods-widgets(\.min)?\.js\??/;

            var i, src, matches, path;
            for (i=0; i<scriptTags.length; i++) {
                src = scriptTags[i].src;
                matches = src.match(odswidgetsRE);

                if (matches) {
                    path = src.split(odswidgetsRE)[0];
                    if (!path) {
                        // Path is '/'
                        ODSWidgetsConfig.basePath = '/';
                    } else if (path.substring(path.length-3) === '.js') {
                        // This is loaded from the same folder
                        ODSWidgetsConfig.basePath = '';
                    } else {
                        ODSWidgetsConfig.basePath = path + '/';
                    }
                }
            }
        }
    }]);
}());
;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.service('ODSAPI', ['$http', 'ODSWidgetsConfig', 'odsErrorService', function($http, ODSWidgetsConfig, odsErrorService) {
        /**
         * This service exposes OpenDataSoft APIs.
         *
         * Each method take a context, and specific parameters to append to this request (without modifying the context).
         * A context is an object usually created by a directive such as dataset-context or catalog-context.
         */
        var request = function(context, path, params, timeout) {
            var url = context ? context.domainUrl : '';
            url += path;
            params = ODS.URLUtils.cleanupAPIParams(params) || {};

            params.timezone = jstz.determine().name();
            if (context && context.apikey) {
                params.apikey = context.apikey;
            }
            var options = {
                params: params
            };
            if (timeout) {
                options.timeout = timeout;
            }

            if (!url.startsWith('http://')) {
                if (ODSWidgetsConfig.customAPIHeaders) {
                    options.headers = ODSWidgetsConfig.customAPIHeaders;
                } else {
                    options.headers = {};
                }
                options.headers['ODS-Widgets-Version'] = ODSWidgetsConfig.ODSWidgetsVersion;
            }
            if (!context.domainUrl || Modernizr.cors) {
                return $http.
                    get(url, options).
                    error(function(data) {
                        if (data) {
                            odsErrorService.sendErrorNotification(data);
                        }
                    });
            } else {
                // Fallback for non-CORS browsers (IE8, IE9)
                // In that case we won't have proper errors from the API
                url += url.indexOf('?') > -1 ? '&' : '?';
                url += 'callback=JSON_CALLBACK';
                return $http.jsonp(url, options);
            }

        };
        return {
            'getDomainURL': function(domain) {
                var root = null;
                if (angular.isUndefined(domain) || domain === null || domain === '') {
                    root = ODSWidgetsConfig.defaultDomain;
                } else {
                    if (domain.substr(0, 1) !== '/' && domain.indexOf('.') === -1) {
                        root = domain+'.opendatasoft.com';
                    } else {
                        root = domain;
                    }
                    if (root.substr(0, 1) !== '/' && root.indexOf('http://') === -1 && root.indexOf('https://') === -1) {
                        root = 'https://' + root;
                    }
                }

                if (root.substr(-1) === '/') {
                    // Remove trailing slash
                    root = root.substr(0, root.length-1);
                }

                return root;
            },
            'datasets': {
                'get': function(context, datasetID, parameters) {
                    return request(context, '/api/datasets/1.0/'+datasetID+'/', parameters);
                },
                'search': function(context, parameters) {
                    var queryParameters = angular.extend({}, context.parameters, parameters);
                    return request(context, '/api/datasets/1.0/search/', queryParameters);
                },
                'facets': function(context, facetName) {
                    return this.search(context, {'rows': 0, 'facet': facetName});
                }
            },
            'records': {
                // FIXME: Why don't we implicitely use the parameters from the context, instead of requiring the widgets
                // to explicitely send them together with the other parameters?
                'analyze': function(context, parameters, timeout) {
//                    return request(context, '/api/datasets/1.0/'+context.dataset.datasetid+'/records/analyze/', parameters);
                    return request(context, '/api/records/1.0/analyze/', angular.extend({}, parameters, {dataset: context.dataset.datasetid}), timeout)
                        .success(function(data, status, headers, config) {
                            if (headers()['ods-analyze-truncated']) {
                                odsErrorService.sendErrorNotification("The analysis results have been truncated because there was too many results.");
                            }
                        });
                },
                'search': function(context, parameters, timeout) {
                    return request(context, '/api/records/1.0/search/', angular.extend({}, parameters, {dataset: context.dataset.datasetid}), timeout);
                },
                'download': function(context, parameters, timeout) {
                    return request(context, '/api/records/1.0/download/', angular.extend({}, parameters, {dataset: context.dataset.datasetid}), timeout);
                },
                'geo': function(context, parameters, timeout) {
                    return request(context, '/api/records/1.0/geocluster/', angular.extend({}, parameters, {dataset: context.dataset.datasetid}), timeout);
                },
                'geopreview': function(context, parameters, timeout) {
                    return request(context, '/api/records/1.0/geopreview/', angular.extend({}, parameters, {dataset: context.dataset.datasetid}), timeout);
                },
                'boundingbox': function(context, parameters, timeout) {
                    return request(context, '/api/records/1.0/boundingbox/', angular.extend({}, parameters, {dataset: context.dataset.datasetid}), timeout);
                },
                'geopolygon': function(context, parameters, timeout) {
                    return request(context, '/api/records/1.0/geopolygon/', angular.extend({}, parameters, {dataset: context.dataset.datasetid}), timeout);
                }
            },
            'reuses': function(context, parameters) {
                return request(context, '/api/reuses/', parameters);
            }
        };
    }]);

}());;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.factory('AggregationHelper', ['translate', function(translate) {
        var availableFunctions = [
            {label: translate('Count'), func: 'COUNT'},
            {label: translate('Average'), func: 'AVG'},
            {label: translate('Minimum'), func: 'MIN'},
            {label: translate('Maximum'), func: 'MAX'},
            {label: translate('Standard deviation'), func: 'STDDEV'},
            {label: translate('Sum'), func: 'SUM'},
            {label: translate('Percentile'), func: 'QUANTILES'},
            // {label: translate('Custom expression'), func: 'CUSTOM'},
            {label: translate('Constant value'), func: 'CONSTANT'}
        ];

        return {
            getAvailableFunctions: function(availableYCount) {
                if (availableYCount === 0) {
                    return [
                        availableFunctions[0],
                        availableFunctions[availableFunctions.length - 1]
                    ];
                } else {
                    return availableFunctions;
                }
            },
            getAvailableFunction: function(f) {
                return availableFunctions[f];
            },
            getFunctionLabel: function(func) {
                func = func.toUpperCase();
                return $.grep(availableFunctions, function(f){return func === f.func;})[0].label;
            }
        }
    }]);

    mod.factory('ChartHelper', ['translate', 'AggregationHelper', 'ODSWidgetsConfig', 'ODSCurrentDomain', 'colorScale', function(translate, AggregationHelper, ODSWidgetsConfig, ODSCurrentDomain, colorScale) {
        var availableX = {},
            availableY = {},
            availableFunctions = [],
            timescales_label = {
                'year': translate('Year'),
                'month': translate('Month'),
                'day': translate('Day'),
                'hour': translate('Hour'),
                'minute': translate('Minute'),
                'month month': translate('Month of year'),
                'day day': translate('Day of month'),
                'day weekday': translate('Day of week'),
                'hour weekday': translate('Hour per weekday'),
                'day month': translate('Day of year'),
                'hour hour': translate('Hour of day')
            },
            callbacks = {},
            initialized = [],
            positions = {
                'top left': {center: ['15%', '20%'], size: '25%'},
                'top right': {center: ['85%', '20%'], size: '25%'},
                'bottom left': {center: ['15%', '80%'], size: '25%'},
                'bottom right': {center: ['85%', '80%'], size: '25%'},
                'center': {}
            },
            defaultColors = ODSWidgetsConfig.chartColors || chroma.brewer.Set2,
            availableCharts = [
                {
                    label: translate('Line'),
                    type: 'line',
                    group: translate('line charts')
                },
                {
                    label: translate('Spline'),
                    type: 'spline',
                    group: translate('line charts')
                },
                {
                    label: translate('Range'),
                    type: 'arearange',
                    group: translate('Area charts'),
                    filter: 'hasNumericField'
                },
                {
                    label: translate('Range spline'),
                    type: 'areasplinerange',
                    group: translate('Area charts'),
                    filter: 'hasNumericField'
                },
                {
                    label: translate('Column range'),
                    type: 'columnrange',
                    group: translate('Area charts'),
                    filter: 'hasNumericField'
                },
                {label: translate('Treemap'), type: 'treemap', group: translate('Special')},
                {label: translate('Area'), type: 'area', group: translate('Area charts')},
                {label: translate('Area spline'), type: 'areaspline', group: translate('Area charts')},
                {label: translate('Column chart'), type: 'column', group: translate('Bar charts')},
                {label: translate('Bar chart'), type: 'bar', group: translate('Bar charts')},
                {label: translate('Pie chart'), type: 'pie', group: translate('Pie charts')},
                {label: translate('Scatter plot'), type: 'scatter', group: translate('line charts')}
            ],
            timeserie_precision_tab = [
                "year",
                "month",
                "day",
                "hour",
                "minute"
            ],
            advanced_precision_tab = [
                'month month',
                'day day',
                'day weekday',
                'hour weekday',
                'day month',
                'hour hour'
            ],
            colorIdx = 0,
            fields = {},
            datasets = {},
            timeSeries;

            var getAvailableTimescalesFromPrecision = function(precision, type, fullList) {
                var forced = false;
                if (!precision) {
                    precision = type == 'date' ? 'day' : 'hour';
                } else {
                    forced = true;
                }
                var res = [];
                for (var i=0; i <= timeserie_precision_tab.indexOf(precision); i++){
                    res.push({name : timeserie_precision_tab[i], label: timescales_label[timeserie_precision_tab[i]]});
                    if (type === 'date' && timeserie_precision_tab[i] == 'day') {
                        break;
                    }
                    if (type === 'datetime' && !forced && timeserie_precision_tab[i] == 'hour') {
                        break;
                    }
                    if (type === 'datetime' && forced && timeserie_precision_tab[i] == 'minute') {
                        break;
                    }
                }
                if (fullList) {
                    for (var j = 0; j < advanced_precision_tab.length; j++) {
                        res.push({name: advanced_precision_tab[j], label: timescales_label[advanced_precision_tab[j]]});
                        if (type === 'date' && timeserie_precision_tab[j] == 'day month') {
                            break;
                        }
                    }
                }
                return res;
            };
        return {
            getDatasetUniqueId: function(datasetid) {
                var dataset;
                angular.forEach(datasets, function(value, key) {
                    if (key.endsWith(datasetid)) {
                        dataset = value;
                    }
                    return false;
                });
                if (dataset) {
                    return dataset.getUniqueId();
                } else {
                    throw "dataset " + datasetid + " not loaded yet.";
                }
            },
            getDataset: function(uniqueid) {
                var dataset;
                angular.forEach(datasets, function(value, key) {
                    if (uniqueid === key) {
                        dataset = value;
                    }
                    return false;
                })
                return dataset;
            },
            isChartSortable: function(chartType) {
                return !this.isRangeChart(chartType);
            },
            isRangeChart: function(chartType) {
                return ['arearange', 'areasplinerange', 'columnrange'].indexOf(chartType) > -1;
            },
            getAllTimescales: function() {
                return getAvailableTimescalesFromPrecision('minute', 'datetime', true);
            },
            getAvailableX: function(datasetid, i, limitToTimeSeries) {
                limitToTimeSeries = !!limitToTimeSeries;
                var that = this;
                if (typeof i === "undefined") {
                    if (!limitToTimeSeries) {
                        return availableX[datasetid];
                    } else {
                        return $.grep(availableX[datasetid], (function(x) { return (['date', 'datetime'].indexOf(that.getFieldType(datasetid, x.name)) !== -1) }));
                    }
                }
                return availableX[datasetid][i];
            },
            getAvailableBreakDowns: function(datasetid, currentX) {
                if (!currentX) {
                    return [];
                }

                var xIsDatetime = (['date', 'datetime'].indexOf(this.getFieldType(datasetid, currentX)) !== -1);
                var a = [];
                for (var i = 0; i < availableX[datasetid].length; i++) {
                    if (availableX[datasetid][i].name !== currentX) {
                        if (!xIsDatetime || ['date', 'datetime'].indexOf(this.getFieldType(datasetid, availableX[datasetid][i].name)) === -1) {
                            a.push({label: availableX[datasetid][i].label, name: availableX[datasetid][i].name});
                        }
                    }
                }
                return a;
            },
            getAvailableY: function(datasetid, i) {
                if (typeof i === "undefined")
                    return availableY[datasetid];
                return availableY[datasetid][i];
            },
            getTimescales: function(datasetid, fieldName, advanced) {
                var precision;
                var field;
                for (var i = 0; i< fields[datasetid].length; i++) {
                    if (fields[datasetid][i].name === fieldName) {
                        field = fields[datasetid][i];
                        break;
                    }
                }
                if (!field) {
                    return;
                }
                if (field.annotations) {
                    for (var annotation=0; annotation<field.annotations.length; annotation++) {
                        if (field.annotations[annotation].name == 'timeserie_precision') {
                            precision = field.annotations[annotation].args[0];
                            break;
                        }
                    }
                }

                return getAvailableTimescalesFromPrecision(precision, field.type, advanced);
            },
            getDatasetId: function(context) {
                return (context.domain || ODSCurrentDomain.domainId) + "." + context.dataset.datasetid;
            },
            init: function(context, limitToTimeSeries, force) {
                if (typeof force === "undefined") {
                    force = false;
                }

                var availableX = [], availableY = [];
                var datasetid = this.getDatasetId(context);

                if (!force && !!(datasetid in initialized)) {
                    return;
                }
                fields[datasetid] = context.dataset.fields;

                var numericalXs = [];

                for (var i = 0; i< fields[datasetid].length; i++) {
                    var field = fields[datasetid][i];

                    if (field.type == 'int' || field.type == 'double') {
                        availableY.push(field);
                    }

                    if (field.type == 'datetime' || field.type == 'date') {
                        availableX.unshift(field);
                    } else if (field.type == 'double' || field.type == 'int') {
                        numericalXs.push(field);
                    } else {
                        // Find out if this is a facet
                        if (field.annotations) {
                            for (var a=0; a<field.annotations.length; a++) {
                                var anno = field.annotations[a];
                                if (anno.name == 'facet') {
                                    availableX.push(field);
                                }
                            }
                        }
                    }
                }
                availableX = availableX.concat(numericalXs);

                this.setAvailableX(datasetid, availableX);
                this.setAvailableY(datasetid, availableY);
                initialized[datasetid] = true;
                datasets[datasetid] = context.dataset;
                this.load(datasetid);
            },
            isInitialized: function(datasetid) {
                if (datasetid === '') {
                    return !!(initialized.length);
                } else {
                    return !!(datasetid in initialized);
                }
            },
            load: function(datasetid) {
                if (callbacks[datasetid]) {
                    for (var i = 0; i < callbacks[datasetid].length; i++) {
                        callbacks[datasetid][i]();
                    }
                }
                callbacks[datasetid] = [];
                if (callbacks['']) {
                    for (var i = 0; i < callbacks[''].length; i++) {
                        callbacks[''][i]();
                    }
                }
                callbacks[''] = [];
            },
            onLoad: function(datasetid, f) {
                if (typeof datasetid === "function") {
                    f = datasetid;
                    datasetid = '';
                }
                if (this.isInitialized(datasetid)) {
                    f();
                } else {
                    if (!(datasetid in callbacks)) {
                        callbacks[datasetid] = [];
                    }
                    if (callbacks[datasetid].indexOf(f) < 0) {
                        callbacks[datasetid].push(f);
                    }
                }
            },
            setAvailableX: function(datasetid, x) {
                availableX[datasetid] = x;
            },
            setAvailableY: function(datasetid, y) {
                availableY[datasetid] = y;
            },
            resolvePosition: function(position) {
                if (typeof position == undefined) {
                    position = "center";
                }
                if (!(position in positions)) {
                    position = "center";
                }
                return positions[position];
            },
            getPieChartPositions: function() {
                return $.map(positions, function(v,k) {return k;});
            },
            getDefaultColors: function() {
                return defaultColors;
            },
            getDefaultColor: function(currentColor, serieType, breakdown, index) {
                return colorScale.getDefaultColor(currentColor, this.getAllowedColors(serieType, breakdown), index);
            },
            getAllowedColors: function(serietype, breakdown) {
                var allowedColors = [];
                if (breakdown || ['pie'].indexOf(serietype) !== -1) {
                    allowedColors.push('range');
                }
                if (!breakdown && ['pie'].indexOf(serietype) === -1) {
                    allowedColors.push('single');
                }
                return allowedColors;
            },
            getAvailableChartTypes: function(datasetid, stacked) {
                var availableChartTypes = [];
                if (datasets[datasetid]) {
                    for (var i = 0; i < availableCharts.length; i++) {
                        if ((stacked && ['column', 'area', 'areaspline', 'line', 'spline', 'bar'].indexOf(availableCharts[i].type) !== -1) || !stacked) {
                            if (typeof availableCharts[i].filter === 'undefined') {
                                availableChartTypes.push(availableCharts[i]);
                            } else if (datasets[datasetid][availableCharts[i].filter]()) {
                                availableChartTypes.push(availableCharts[i]);
                            }
                        }
                    }
                }
                return availableChartTypes;
            },
            getSerieTemplate: function() {
                return angular.copy({
                });
            },
            setChartDefaultValues: function(datasetid, chart, conservative) {
                var cumulatedQueriesTimescale = '',
                    xType;
                if (typeof conservative === "undefined") {
                    conservative = false;
                }
                if (!chart.timescale) {
                    for (var i = 0; i < chart.queries.length; i++) {
                        xType = this.getFieldType(datasetid, chart.queries[i].xAxis);
                        if (chart.queries[i].timescale && (xType === 'date' || xType === "datetime")) {
                            cumulatedQueriesTimescale = chart.queries[i].timescale;
                        }
                    }

                    if (cumulatedQueriesTimescale) {
                        chart.timescale = chart.queries[0].timescale;
                    }
                } else {
                    for (var i = 0; i < chart.queries.length; i++) {
                        xType = this.getFieldType(datasetid, chart.queries[i].xAxis);
                        if (chart.queries[i].timescale && (xType === 'date' || xType === "datetime")) {
                            cumulatedQueriesTimescale = chart.queries[i].timescale;
                        }
                    }
                    if (!cumulatedQueriesTimescale) {
                        chart.timescale = '';
                    }
                }

                // apply global timscale to queries that eventually might not anything set
                if (chart.timescale) {
                    for (var i = 0; i < chart.queries.length; i++) {
                        if (!chart.queries[i].timescale) {
                            chart.queries[i].timescale = chart.timescale;
                        }
                    }
                }
                if (!chart.singleAxis) {
                    delete(chart.singleAxisLabel);
                    delete(chart.singleAxisScale);
                    delete(chart.yRangeMin);
                    delete(chart.yRangeMax);
                }
                // cleanup unwanted values
                if (!conservative) {
                    delete chart.xLabel;
                }
            },
            setDefaultQueryValues: function(datasetid, query, advancedFeatures, dontTouchMaxpoints, globalTimescale, conservative) {
                if (!query) {
                    query = {};
                }
                var searchOptions = {};
                var defaultX = searchOptions.x || this.getAvailableX(datasetid, 0).name;
                var defaultMaxpoints = 50;
                var defaultTimescale = '';
                if (this.getFieldType(datasetid, defaultX) == 'date' || this.getFieldType(datasetid, defaultX) == 'datetime') {
                    // If the default X is a date/datetime, then we assume timeserie mode and we remove any limitation
                    defaultMaxpoints = '';
                    defaultTimescale = searchOptions.timescale || 'year';
                }
                if (!query.xAxis) {
                    query.xAxis = defaultX;
                }

                if (typeof query.maxpoints === "undefined") {
                    query.maxpoints = defaultMaxpoints;
                }
                if (!query.charts) {
                    query.charts = [];
                }

                // if (defaultTimescale) {
                //     query.timescale = query.timescale || defaultTimescale;
                // }
                var xAxis = query.xAxis;
                var xType = this.getFieldType(datasetid, xAxis);

                if (xType == 'date' || xType == 'datetime') {
                    if(!query.timescale || this.getTimescales(datasetid, xAxis, advancedFeatures).map(function(t){return t.name;}).indexOf(query.timescale) === -1) {
                        // Set a default timescale value
                        query.timescale = 'year';
                        if (advancedFeatures && globalTimescale) {
                            query.timescale = globalTimescale;
                        } else {
                            // TODO use precision annotation to set the timescale more precisely by default
                            // don't go lower than day
                            query.timescale = 'year';
                        }
                    }
                } else {
                    if (query.timescale){
                        query.timescale = '';
                    }
                }
                if (query.seriesBreakdown === xAxis) {
                    query.seriesBreakdown = '';
                    query.seriesBreakdownTimescale = '';
                }

                var forceBreakdownRemoval = false;
                for (var i = 0; i < query.charts.length; i++) {
                    if (['treemap', 'pie'].indexOf(query.charts[i].type) !== -1) {
                        forceBreakdownRemoval = true;
                    }
                }

                if (forceBreakdownRemoval) {
                    query.seriesBreakdown = '';
                    query.seriesBreakdownTimescale = '';
                }

                if (!query.seriesBreakdown && query.charts.length < 2) {
                    delete query.stacked;
                }

                if (!query.sort || query.seriesBreakdown) {
                    query.sort = '';
                }
            },
            setSerieDefaultValues: function(datasetid, chart, xAxis, conservative) {
                // Compute default labels
                // Enveloppe
                if (typeof xAxis === "undefined") {
                    return;
                }

                var availableY = this.getAvailableY(datasetid);
                if (!chart.type) {
                    chart.type = 'column';
                    if (xAxis && (this.getFieldType(datasetid, xAxis) == 'date' || this.getFieldType(datasetid, xAxis) == 'datetime')) {
                        chart.type = 'line';
                    }
                }

                if (!chart.func) {
                    chart.func = availableY.length > 0 ? 'AVG' : 'COUNT';
                }

                if (typeof chart.expr !== "undefined" && typeof chart.yAxis === "undefined") {
                    chart.yAxis = chart.expr;
                    delete chart.expr;
                }

                if (typeof chart.yAxis === "undefined" || chart.yAxis === "") {
                    // there is no yAxis defined, check if it's ok or if need to define one
                    if (availableY.length === 0 && ['COUNT', 'CONSTANT', 'CUSTOM'].indexOf(chart.func) === -1) {
                        chart.func = 'COUNT';
                    }
                    if (!conservative && ['COUNT', 'CONSTANT', 'CUSTOM'].indexOf(chart.func) === -1) {
                        // the current function needs an yAxis
                        chart.yAxis = availableY[0].name;
                    // } else { // remove current yAxis, not needed by the current function
                    //     chart.yAxis = '';
                    }
                } else {
                    // there is an yAxis defined, we need to check if it still exists
                    if (!conservative && ['COUNT', 'CONSTANT', 'CUSTOM'].indexOf(chart.func) === -1) {
                        if ($.grep(availableY, function(y) {return y.name === chart.yAxis}).length === 0) {
                            // the currently defined y does not seem to exists anymore, fallback on the first available one
                            chart.yAxis = availableY[0].name;
                        }
                    }
                }

                if(chart.type && this.isRangeChart(chart.type)){
                    chart.func = 'COUNT';
                    if(!chart.charts){
                        chart.charts = [
                            {
                                func: 'MIN',
                                yAxis: chart.yAxis
                            },
                            {
                                func: 'MAX',
                                yAxis: chart.yAxis
                            }
                        ];
                    }
                    if (typeof chart.charts[0].yAxis === "undefined" || chart.charts[0].yAxis === "") {
                        chart.charts[0].yAxis = chart.charts[0].expr || chart.yAxis;
                        delete chart.charts[0].expr;
                    }
                    if (typeof chart.charts[1].yAxis === "undefined" || chart.charts[1].yAxis === "") {
                        chart.charts[1].yAxis =  chart.charts[1].expr || chart.yAxis;
                        delete chart.charts[1].expr;
                    }
                    if(chart.charts[0].func === 'QUANTILES' && (chart.charts[0].subsets === "" || typeof chart.charts[0].subsets === "undefined")){
                        chart.charts[0].subsets = 5;
                    }
                    if(chart.charts[1].func === 'QUANTILES' && (chart.charts[1].subsets === "" || typeof chart.charts[1].subsets === "undefined")){
                        chart.charts[1].subsets = 95;
                    }

                    if (chart.charts[0].func !== 'QUANTILES' && chart.charts[0].subsets) {
                        delete chart.charts[0].subsets;
                    }
                    if (chart.charts[1].func !== 'QUANTILES' && chart.charts[1].subsets) {
                        delete chart.charts[1].subsets;
                    }
                } else {
                    if(chart.charts){
                        delete chart.charts;
                    }
                    if(chart.func === 'QUANTILES'){
                        if (!chart.subsets){
                            chart.subsets = 50;
                        }
                    } else {
                        if (chart.subsets) {
                          delete chart.subsets;
                        }
                    }
                }

                if (chart.type === "pie" && !chart.position) {
                    chart.position = "center";
                }

                if (chart.type !== 'column' && chart.type !== 'bar' && chart.displayStackValues) {
                    chart.displayStackValues = false;
                }

                // cleanup unwanted values
                delete chart.yLabel;
                delete chart.extras;
            },
            setSerieDefaultColors: function(serie, breakdown, index) {
                serie.color = this.getDefaultColor(serie.color, serie.type, breakdown, index);
            },
            getXLabel: function(datasetid, xAxis, timescale, precision) {
                var xType = this.getFieldType(datasetid, xAxis);
                var xLabel = this.getFieldLabel(datasetid, xAxis);
                if ((xType === 'date' || xType === 'datetime') && timescale) {
                    // Timeserie
                    return xLabel + ' (' + timescales_label[timescale] + ')';
                } else {
                    return xLabel;
                }
            },
            getYLabel: function(datasetid, chart) {
                if (chart.yLabelOverride) {
                    return chart.yLabelOverride;
                } else {
                    if (this.isRangeChart(chart.type)) {
                        return this.getYLabel(datasetid, chart.charts[0]) + " / " + this.getYLabel(datasetid, chart.charts[1]);
                    } else {
                        var funcLabel = AggregationHelper.getFunctionLabel(chart.func);
                        var nameY = chart.yAxis || chart.expr;
                        var possibleYAxis = $.grep(this.getAvailableY(datasetid), function(y){return y.name == nameY;});
                        if (possibleYAxis.length > 0 && chart.func !== "COUNT" && chart.func !== "CONSTANT" && chart.func !== "CUSTOM") {
                            return funcLabel + ' ' + possibleYAxis[0].label;
                        } else {
                            return funcLabel;
                        }
                    }
                }
            },
            getField: function(datasetid, fieldName) {
                if (!fields[datasetid]) return null;
                for (var i=0; i < fields[datasetid].length; i++) {
                    var field = fields[datasetid][i];
                    if (field.name == fieldName) {
                        return field;
                    }
                }
                return undefined;
            },
            getFieldLabel: function(datasetid, fieldName) {
                var field = this.getField(datasetid, fieldName);
                if (!field) {
                    return field;
                }
                return field.label;
            },
            getFieldType: function(datasetid, fieldName) {
                var field = this.getField(datasetid, fieldName);
                if (!field) {
                    return field;
                }
                return field.type;
            },
            getFieldUnit: function(datasetid, fieldName) {
                var field = this.getField(datasetid, fieldName);
                if (field.annotations) {
                    for (var i = 0; i < field.annotations.length; i++) {
                        if (field.annotations[i].name === "unit") {
                            return field.annotations[i].args[0];
                        }
                    }
                    return field.annotations.unit;
                }
                return false;
            },
            getAvailableFunctions: function(datasetid) {
                return AggregationHelper.getAvailableFunctions(this.getAvailableY(datasetid).length);
            },
            allowThresholds: function(type) {
                return ['column', 'bar', 'scatter'].indexOf(type) !== -1;
            }
        };
    }]);

}());
;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.factory("colorScale", ['ODSWidgetsConfig', function(ODSWidgetsConfig) {

        var orderedBrewer = [
                {label: 'Accent', colors: chroma.brewer.Accent},
                {label: 'Dark2', colors: chroma.brewer.Dark2},
                {label: 'Pastel2', colors: chroma.brewer.Pastel2},
                {label: 'Pastel1', colors: chroma.brewer.Pastel1},
                {label: 'Set2', colors: chroma.brewer.Set2},
                {label: 'Set1', colors: chroma.brewer.Set1},
                {label: 'Paired', colors: chroma.brewer.Paired},
                {label: 'Set3', colors: chroma.brewer.Set3},
                {label: 'OrRd', colors: chroma.brewer.OrRd.slice(1)},
                {label: 'PuBu', colors: chroma.brewer.PuBu.slice(1)},
                {label: 'BuPu', colors: chroma.brewer.BuPu.slice(1)},
                {label: 'Oranges', colors: chroma.brewer.Oranges.slice(1)},
                {label: 'YlOrBr', colors: chroma.brewer.YlOrBr.slice(1)},
                {label: 'YlGn', colors: chroma.brewer.YlGn.slice(1)},
                {label: 'Reds', colors: chroma.brewer.Reds.slice(1)},
                {label: 'RdPu', colors: chroma.brewer.RdPu.slice(1)},
                {label: 'Greens', colors: chroma.brewer.Greens.slice(1)},
                {label: 'YlGnBu', colors: chroma.brewer.YlGnBu.slice(1)},
                {label: 'Purples', colors: chroma.brewer.Purples.slice(1)},
                {label: 'GnBu', colors: chroma.brewer.GnBu.slice(1)},
                {label: 'Greys', colors: chroma.brewer.Greys.slice(1)},
                {label: 'YlOrRd', colors: chroma.brewer.YlOrRd.slice(1)},
                {label: 'PuRd', colors: chroma.brewer.PuRd.slice(1)},
                {label: 'Blues', colors: chroma.brewer.Blues.slice(1)},
                {label: 'PuBuGn', colors: chroma.brewer.PuBuGn.slice(1)},
                {label: 'Spectral', colors: chroma.brewer.Spectral},
                {label: 'RdYlGn', colors: chroma.brewer.RdYlGn},
                {label: 'RdBu', colors: chroma.brewer.RdBu},
                {label: 'PiYG', colors: chroma.brewer.PiYG},
                {label: 'PRGn', colors: chroma.brewer.PRGn},
                {label: 'RdYlBu', colors: chroma.brewer.RdYlBu},
                {label: 'BrBG', colors: chroma.brewer.BrBG},
                {label: 'RdGy', colors: chroma.brewer.RdGy},
                {label: 'PuOr', colors: chroma.brewer.PuOr}
            ],
            defaultColorSet = 'Set2',
            domainDefaultColorSet = '',
            colorIdx = 0;

        if (ODSWidgetsConfig.chartColors && ODSWidgetsConfig.chartColors.length > 0) {
            domainDefaultColorSet = 'custom';
            var localDomainColorSet = angular.copy(ODSWidgetsConfig.chartColors);
            if (!angular.isArray(localDomainColorSet)) {
                localDomainColorSet = [localDomainColorSet];
            }
            if (localDomainColorSet.length == 1) {
                localDomainColorSet.push(localDomainColorSet[0]);
            }
            orderedBrewer.unshift({
                label: 'custom',
                colors: localDomainColorSet
            });

            chroma.brewer['custom'] = localDomainColorSet;
        }
        function getBrewName(colorString) {
            var brewName;

            if (!colorString) {
                brewName = domainDefaultColorSet || defaultColorSet;
            } else {
                if (colorString.startsWith('custom-')) {
                    colorString = colorString.replace('custom-', '');
                }
                if (colorString.startsWith('range-')) {
                    colorString = colorString.replace('range-', '');
                } else if (colorString.startsWith('single-')) {
                    colorString = colorString.replace('single-', '');
                }
                if (chroma.brewer[colorString]) {
                    brewName = colorString;
                }
            }

            return brewName;
        }
        function getScaleFromString(colorString) {
            var brewName = getBrewName(colorString),
                colorScale;

            if (brewName) {
                colorScale = chroma.scale(brewName);
            } else {
                colorString = colorString.replace('custom-', '');
                colorString = colorString.replace('single-', '');
                colorScale = chroma.scale().range([colorString, colorString]);
            }

            return colorScale;
        }
        return {
            getScale: function(colorString, min, max) {
                var brewName, colorScale;

                min = typeof min !== "undefined" ? min : 0;
                max = typeof max !== "undefined" ? max : 1;

                return getScaleFromString(colorString).domain([min, max]);
            },
            getUniqueColor: function(colorString) {
                return getScaleFromString(colorString)(1).hex();
            },
            getColorAtIndex: function(colorString, index) {
                var brewName = getBrewName(colorString),
                    brew;
                if (brewName) {
                    brew = chroma.brewer[brewName];
                    return brew[index % brew.length];
                } else {
                    return colorString;
                }
            },
            getColors: function(colorString) {
                var brewName = getBrewName(colorString);
                if (brewName) {
                    return chroma.brewer[brewName];
                } else {
                    return [colorString, colorString];
                }
            },
            getColorSets: function() {
                return chroma.brewer;
            },
            getOrderedColorSets: function() {
                return orderedBrewer;
            },
            getDefaultColorSet: function() {
                return domainDefaultColorSet || defaultColorSet;
            },
            getDefaultColor: function(currentColor, allowedColors, index) {
                var defaultColors = this.getColorList(allowedColors),
                    color;

                if (typeof currentColor !== "undefined" && currentColor !== "") {
                    return currentColor;
                } else if (typeof backupColor !== "undefined" && backupColor !== "") {
                    // coming back from a pie chart, we don't want to increase the color counter
                    return backupColor;
                } else {
                    if (defaultColors[colorIdx].label.startsWith('custom-')) {
                        colorIdx = (colorIdx + 1) % defaultColors.length;
                    }
                    if (typeof index !== "undefined") {
                        color = defaultColors[index % defaultColors.length].label;
                    } else {
                        color = defaultColors[colorIdx].label;
                        colorIdx = (colorIdx + 1) % defaultColors.length;
                    }
                    return color;
                }
            },
            getColorList: function(allowedcolors, currentcolor) {
                var colorlist = [];
                if (allowedcolors.indexOf('single') !== -1) {
                    var colors = this.getColors(this.getDefaultColorSet());
                    angular.forEach(colors, function(color) {
                        colorlist.push({'label': color, 'color': color});
                    });
                }
                if (allowedcolors.indexOf('range') !== -1) {
                    angular.forEach(this.getOrderedColorSets(), function(colorrange) {
                        colorlist.push({'label': 'range-' + colorrange['label'], 'color': colorrange['colors']});
                    });
                }
                return colorlist;
            },
            isColorAllowed: function(checkedColor, colorlist, allowedcolors) {
                var found = false;

                if (!checkedColor) {
                    return false;
                }

                if (allowedcolors.indexOf('range') === -1) {
                    if (checkedColor.startsWith('range-') || checkedColor.startsWith('custom-range-')) {
                        return false;
                    } else {
                        return true;
                    }
                }

                if (allowedcolors.indexOf('range') !== -1) {
                    if (checkedColor.startsWith('custom-single-')) {
                        return false;
                    } else {
                        angular.forEach(colorlist, function(color) {
                            if (color.label === checkedColor) {
                                found = true;
                            }
                        });

                        return found;
                    }
                }
            }

        }
    }]);

}());;(function() {
    "use strict";

    var mod = angular.module('ods-widgets');

    mod.provider('ODSCurrentDomain', [function() {
        /**
         * @ngdoc object
         * @name ods-widgets.ODSCurrentDomainProvider
         * @description
         * Use `ODSCurrentDomainProvider` to set configuration values for the current domain.
         * The available settings are:
         *
         * - **`domainId`** - {@type string} - Value used as `domain` parameter for {@link ods-widgets.directive:odsCatalogContext Catalog Contexts}
         * and {@link ods-widgets.directive:odsDatasetContext Dataset Contexts} when none is specified. Defaults is '' (empty string), which means a local API (root is /).
         *
         * @example
         * <pre>
         *   var app = angular.module('ods-widgets').config(function(ODSCurrentDomainProvider) {
         *       ODSCurrentDomainProvider.setDomain('public');
         *   });
         * </pre>
         */
        /**
         * @ngdoc service
         * @name ods-widgets.ODSCurrentDomain
         * @description
         * A service containing the current domain informations. Available informations are described
         * in the {@link ods-widgets.ODSCurrentDomainProvider ODSCurrentDomainProvider} documentation.
         */

        var currentDomain = {};

        currentDomain.domainId = "";
        
        this.setDomain = function(domainId) {
            currentDomain.domainId = domainId;
        };

        this.$get = function() {
            return currentDomain;
        };
    }]);
}());;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.factory('MapHelper', ['ODSWidgetsConfig', 'ODSAPI', '$q', function(ODSWidgetsConfig, ODSAPI, $q) {
        var locationAccuracy = 5;
        var locationDelimiter = ',';

        return {
            WORLD_BOUNDS: [[-60, -180], [80, 180]],
            retrieveBounds: function(contextList) {
                var service = this;
                /* Retrieves a bounding box that includes all the data visible from the context list */
                var deferred = $q.defer();

                if (contextList.length === 0) {
                    deferred.resolve(null);
                } else {
                    var promises = [];
                    angular.forEach(contextList, function(ctx) {
                        var options = {};
                        jQuery.extend(options, ctx.parameters);
                        promises.push(ODSAPI.records.boundingbox(ctx, options));
                    });

                    $q.all(promises).then(function(results) {
                        var bounds;

                        angular.forEach(results, function(result) {
                            var data = result.data;
                            var newBounds = [[data.bbox[1], data.bbox[0]], [data.bbox[3], data.bbox[2]]];
                            if (data.count > 0) {
                                if (!bounds) {
                                    bounds = L.latLngBounds(newBounds);
                                } else {
                                    bounds.extend(newBounds);
                                }
                            }
                        });

                        if (bounds && bounds.isValid()) {
                            deferred.resolve(bounds);
                        } else {
                            // Fallback to... the world
                            deferred.resolve(service.WORLD_BOUNDS);
                        }
                    });
                }

                return deferred.promise;
            },
            getLocationStructure: function(location) {
                /* Takes a "location" parameter (zoom, lat,lng) and returns a structured object */
                var tokens = location.split(locationDelimiter);
                return {
                    center: [tokens[1], tokens[2]],
                    zoom: tokens[0]
                };
            },
            getLocationParameter: function(center, zoom) {
                /* Takes a center and a zoom, and returns a "location" parameter suitable for sharing. The position
                * is "blurred" to ensure the URL does not change at every pixel, to enhance performance a bit and avoid
                * weird side effects like this problem where Chrome pops an option to allow geolocalisation of the user,
                * but the URL changes immediately because the viewport is shrinked by a few pixels, and the option disappears. */
                if (angular.isArray(center)) {
                    center = L.latLng(center);
                }
                var lat = L.Util.formatNum(center.lat, locationAccuracy);
                var lng = L.Util.formatNum(center.lng, locationAccuracy);
                return zoom + locationDelimiter + lat + locationDelimiter + lng;
            },
            MapConfiguration: {
                getActiveContextList: function(config, options) {
                    /*
                    Options:
                    {
                        geoOnly (true/false, default false): only keeps datasets with geo field
                        skipExcludedFromRefit (true/false, default false): effectively excludes from the list the layers
                            that have been "excluded from refit"
                    }
                     */
                    options = options || {};
                    var contexts = [];
                    /* Returns all the contexts from active layergroups */
                    angular.forEach(config.layers, function(group) {
                        if (group.displayed) {
                            angular.forEach(group.activeDatasets, function(datasetConfig) {
                                if (!options.geoOnly || datasetConfig.context.dataset.hasGeoField()) {
                                    if (!(datasetConfig.excludeFromRefit && options.skipExcludedFromRefit)) {
                                        contexts.push(datasetConfig.context);
                                    }
                                }
                            });
                        }
                    });
                    return contexts;
                },
                createLayerGroupConfiguration: function() {
                    return {
                        "color": "#369",
                        "title": "Calque #1",
                        "displayed": true,
                        "picto": "icon-circle",
                        "activeDatasets": []
                    };
                },
                createLayerConfiguration: function(template, config) {
                    if (angular.isUndefined(config)) {
                        config = {};
                    }
                    var display = config.display || 'auto';
                    if (display === 'clusters') { display = 'polygon'; }
                    if (display === 'clustersforced') { display = 'polygonforced'; }
                    if (display === 'raw') { display = 'none'; }
                    return {
                        "context": null,
                        "color": config.color,
                        "picto": config.picto,
                        "clusterMode": display,
                        "func": config['function'] || (config.expression ? "AVG" : "COUNT"), // If there is a field, default to the average
                        "expr": config.expression || null,
                        "marker": null,
                        "tooltipTemplate": template,
                        "localKey": config.localKey || null,
                        "remoteKey": config.remoteKey || null,
                        "tooltipSort": config.tooltipSort,
                        "hoverField": config.hoverField || null,
                        "opacity": config.opacity,
                        "borderColor": config.borderColor,
                        "excludeFromRefit": config.excludeFromRefit
                    };
                }
            }
        };
    }]);

    mod.factory('MapLayerRenderer', ['ODSAPI', 'AggregationHelper', 'SVGInliner', 'PictoHelper', '$q', '$filter', '$rootScope', '$compile', '$timeout', function(ODSAPI, AggregationHelper, SVGInliner, PictoHelper, $q, $filter, $rootScope, $compile, $timeout) {
        // TODO: Query interruption when moving
        return {
            updateDataLayer: function (layerConfig, map) {
                var service = this;
                var previousRenderedLayer = layerConfig.rendered;

                // Depending on the rendering mode, we either replace the previous layer with a new one, or we update
                // the existing one (tiles).

                // Available modes:
                // none: downloading all points
                // polygon, polygonforced: circles clustering
                // heatmap
                // aggregation (former "shape") - local and remote

                if (layerConfig.currentRequestTimeout) {
                    layerConfig.currentRequestTimeout.resolve();
                }
                var timeout = $q.defer();
                layerConfig.currentRequestTimeout = timeout;
                var deferred = $q.defer();
                if (layerConfig.clusterMode === 'tiles') {
                    // TODO
                    // If the bundlelayer already exists in layerConfig.layer, then setUrl to it.
                    if (!layerConfig.rendered) {
                        layerConfig.rendered = new L.BundleTileLayer('', {
                            tileSize: 512,
                            minZoom: map.getMinZoom(),
                            maxZoom: map.getMaxZoom(),
                            gridLayer: {
                                options: {
                                    resolution: 4
                                }
                            }
                        });
                        map.addLayer(layerConfig.rendered);

                        $timeout(function() {
                            // We have to bootstrap them outside of the angular cycle, otherwise it will directly trigger
                            // the first time and make a "digest already in progress"
                            layerConfig.rendered.on('loading', function () {
                                layerConfig.loading = true;
                                $rootScope.$apply();
                            });
                            layerConfig.rendered.on('load', function () {
                                layerConfig.loading = false;
                                $rootScope.$apply();
                            });
                        }, 0);

                        service.bindTooltip(map, layerConfig.rendered, layerConfig);
                    }
                    var tilesOptions = {
                        color: layerConfig.color,
                        icon: layerConfig.picto,
                        showmarker: layerConfig.marker
                    };
                    angular.extend(tilesOptions, layerConfig.context.parameters);
                    // Change tile URL
                    var url = '/api/datasets/1.0/' + layerConfig.context.dataset.datasetid + '/tiles/simple/{z}/{x}/{y}.bundle';
                    //var url = '/api/tiles/icons/{z}/{x}/{y}.bundle';
                    var params = '';
                    angular.forEach(tilesOptions, function(value, key) {
                        if (value !== null) {
                            params += params ? '&' : '?';
                            params += key + '=' + encodeURIComponent(value);
                        }
                    });
                    url += params;
                    if (layerConfig.rendered._url !== url) {
                        layerConfig.rendered.setUrl(url);
                    }
                    // FIXME: Bind to load/unload to not resolve until all is loaded
                    deferred.resolve();
                } else if (layerConfig.clusterMode === 'none' || map.getZoom() === map.getMaxZoom() && layerConfig.clusterMode === 'polygon') {
                    layerConfig.loading = true;
                    this.buildRawLayer(layerConfig, map, timeout).then(function(rawLayer) {
                        service.swapLayers(map, previousRenderedLayer, rawLayer);
                        layerConfig.rendered = rawLayer;
                        layerConfig.currentRequestTimeout = null;
                        layerConfig.loading = false;
                        deferred.resolve();
                    });
                } else if (layerConfig.clusterMode === 'polygon' || layerConfig.clusterMode === 'polygonforced') {
                    layerConfig.loading = true;
                    this.buildClusteredLayer(layerConfig, map, timeout, true).then(function(clusteredLayer) {
                        service.swapLayers(map, previousRenderedLayer, clusteredLayer);
                        layerConfig.rendered = clusteredLayer;
                        layerConfig.currentRequestTimeout = null;
                        layerConfig.loading = false;
                        deferred.resolve();
                    });
                } else if (layerConfig.clusterMode === 'heatmap') {
                    layerConfig.loading = true;
                    this.buildHeatmapLayer(layerConfig, map, timeout).then(function (heatmapLayer) {
                        service.swapLayers(map, previousRenderedLayer, heatmapLayer);
                        layerConfig.rendered = heatmapLayer;
                        layerConfig.currentRequestTimeout = null;
                        layerConfig.loading = false;
                        deferred.resolve();
                    });
                } else if (layerConfig.clusterMode === 'shape' || layerConfig.clusterMode === 'aggregation') { // 'shape' is legacy
                    layerConfig.loading = true;
                    this.buildAggregationLayer(layerConfig, map, timeout).then(function(shapeLayer) {
                        service.swapLayers(map, previousRenderedLayer, shapeLayer);
                        layerConfig.rendered = shapeLayer;
                        layerConfig.currentRequestTimeout = null;
                        layerConfig.loading = false;
                        deferred.resolve();
                    });
                } else if (layerConfig.clusterMode === 'auto') {
                    layerConfig.loading = true;
                    // Auto-decide what to do depending on the number of items
                    var parameters = angular.extend({}, layerConfig.context.parameters, {
                        'geofilter.bbox': ODS.GeoFilter.getBoundsAsBboxParameter(map.getBounds())
                    });
                    ODSAPI.records.boundingbox(layerConfig.context, parameters).success(function(data) {
                        /*
                            0 < x < DOWNLOAD_CAP : Download all points
                            DOWWNLOAD_CAP < x < [SHAPEPREVIEW/POLYGONCLUSTERS]_HIGHCAP: call geopreview/geopolygon
                         */
                        // TODO: Use geopreview when low cap?
                        // TODO: Factorize the "service.buildRawLayer..." which is already used above
                        var DOWNLOAD_CAP = 200;
                        var SHAPEPREVIEW_HIGHCAP = 500000;
                        // The number of points where we stop asking for the polygon representing the cluster's content
                        var POLYGONCLUSTERS_HIGHCAP = 500000;

                        var returnPolygons = (data.count < POLYGONCLUSTERS_HIGHCAP);

                        if (data.geometries && data.geometries.Point && data.geometries.Point > data.count/2 && (data.count < DOWNLOAD_CAP || map.getZoom() === map.getMaxZoom())) {
                            // Low enough and mostly points: always download
                            service.buildRawLayer(layerConfig, map, timeout).then(function(rawLayer) {
                                service.swapLayers(map, previousRenderedLayer, rawLayer);
                                layerConfig.rendered = rawLayer;
                                layerConfig.currentRequestTimeout = null;
                                layerConfig.loading = false;
                                deferred.resolve();
                            });
                        } else if (data.count < SHAPEPREVIEW_HIGHCAP) {
                            // We take our decision depending on the content of the envelope
                            if (data.geometries && data.geometries.Point && data.geometries.Point > data.count/2) {
                                // Geo polygons
                                service.buildClusteredLayer(layerConfig, map, timeout, returnPolygons).then(function(clusteredLayer) {
                                    service.swapLayers(map, previousRenderedLayer, clusteredLayer);
                                    layerConfig.rendered = clusteredLayer;
                                    layerConfig.currentRequestTimeout = null;
                                    layerConfig.loading = false;
                                    deferred.resolve();
                                });
                            } else {
                                // Geo preview
                                service.buildShapePreviewLayer(layerConfig, map, timeout).then(function(previewLayer) {
                                    service.swapLayers(map, previousRenderedLayer, previewLayer);
                                    layerConfig.rendered = previewLayer;
                                    layerConfig.currentRequestTimeout = null;
                                    layerConfig.loading = false;
                                    deferred.resolve();
                                });
                            }
                        } else {
                            // Clusters
                            service.buildClusteredLayer(layerConfig, map, timeout, returnPolygons).then(function(clusteredLayer) {
                                service.swapLayers(map, previousRenderedLayer, clusteredLayer);
                                layerConfig.rendered = clusteredLayer;
                                layerConfig.currentRequestTimeout = null;
                                layerConfig.loading = false;
                                deferred.resolve();
                            });
                        }
                    });
                }
                return deferred.promise;
            },
            swapLayers: function(map, oldLayer, newLayer) {
                if (oldLayer) {
                    map.removeLayer(oldLayer);
                }
                map.addLayer(newLayer);
            },
            /*                               */
            /*          RENDERING            */
            /*                               */
            buildRawLayer: function(layerConfig, map, timeout) {
                var service = this;
                var deferred = $q.defer();
                var markerLayerGroup = new L.LayerGroup();
                var parameters = angular.extend({}, layerConfig.context.parameters, {
                    'rows': 1000,
                    'format': 'json',
                    'geofilter.bbox': ODS.GeoFilter.getBoundsAsBboxParameter(map.getBounds())
                });
                // Which fields holds the geometry?
                var shapeFields = layerConfig.context.dataset.getFieldsForType('geo_shape');
                var shapeField = shapeFields.length ? shapeFields[0].name : null;
                ODSAPI.records.download(layerConfig.context, parameters, timeout.promise).success(function (data) {
                    for (var i = 0; i < data.length; i++) {
                        var record = data[i];
                        var geoJSON;

                        if (shapeField) {
                            if (record.fields[shapeField]) {
                                geoJSON = record.fields[shapeField];
                                if (geoJSON.type === 'Point' && angular.isDefined(record.geometry)) {
                                    // Due to a problem with how we handke precisions, we query a point with a lower precision than
                                    // the geoJSON, so we need to use the geometry field instead.
                                    geoJSON = record.geometry;
                                }
                            } else {
                                // The designated shapefield has no value, skip
                                return;
                            }
                        } else if (record.geometry) {
                            geoJSON = record.geometry;
                        } else {
                            return;
                        }

                        if (geoJSON.type === 'Point') {
                            (function(geoJSON, record) {
                                SVGInliner.getPromise(PictoHelper.mapPictoToURL(layerConfig.picto, layerConfig.context), layerConfig.marker ? 'white' : service.getRecordColor(record, layerConfig)).then(function(svg) {
                                    var singleMarker = new L.VectorMarker([geoJSON.coordinates[1], geoJSON.coordinates[0]], {
                                        color: service.getRecordColor(record, layerConfig),
                                        icon: svg,
                                        marker: layerConfig.marker
                                    });
                                    service.bindTooltip(map, singleMarker, layerConfig, geoJSON, record.recordid);
                                    markerLayerGroup.addLayer(singleMarker);
                                });
                            }(geoJSON, record));
                        } else {
                            var shapeLayer = new L.GeoJSON(geoJSON, {
                                style: function(feature) {
                                    var opts = {
                                        radius: 3,
                                        weight: 1,
                                        opacity: 0.9,
                                        fillOpacity: 0.5,
                                        color: service.getRecordColor(record, layerConfig)
                                    };
                                    opts.fillColor = service.getRecordColor(record, layerConfig);
                                    if (angular.isDefined(layerConfig.opacity)) {
                                        opts.fillOpacity = layerConfig.opacity;
                                    }
                                    if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
                                        opts.weight = 5;
                                        opts.color = service.getRecordColor(record, layerConfig);
                                    } else {
                                        if (angular.isDefined(layerConfig.borderColor)) {
                                            opts.color = layerConfig.borderColor;
                                        } else {
                                            opts.color = "#fff";
                                        }
                                    }
                                    return opts;
                                }
                            });
                            service.bindTooltip(map, shapeLayer, layerConfig, geoJSON, record.recordid);
                            markerLayerGroup.addLayer(shapeLayer);
                        }


                    }
                    deferred.resolve(markerLayerGroup);
                });
                return deferred.promise;
            },
            buildClusteredLayer: function(layerConfig, map, timeout, showPolygons) {
                var service = this;
                var deferred = $q.defer();
                var layerGroup = new L.LayerGroup();
                var parameters = angular.extend({}, layerConfig.context.parameters, {
                    'clusterdistance': 50,
                    'clusterprecision': map.getZoom(),
                    'geofilter.bbox': ODS.GeoFilter.getBoundsAsBboxParameter(map.getBounds()),
                    'return_polygons': showPolygons
                });

                if (layerConfig.func !== 'COUNT' && service.isAnalyzeEnabledClustering(layerConfig)) {
                    parameters['y.serie1.expr'] = layerConfig.expr;
                    parameters['y.serie1.func'] = layerConfig.func;
                }

                ODSAPI.records.geo(layerConfig.context, parameters, timeout.promise).success(function(data) {
                    // Display the clusters
                    var records = data.clusters;
                    for (var i=0; i<records.length; i++) {
                        var record = records[i];
                        if (record.count === 1 && layerConfig.clusterMode !== 'polygonforced') {
                            (function(record) {
                                SVGInliner.getPromise(PictoHelper.mapPictoToURL(layerConfig.picto, layerConfig.context), layerConfig.marker ? 'white' : layerConfig.color).then(function(svg) {
                                    var singleMarker = new L.VectorMarker(record.cluster_center, {
                                        color: layerConfig.color,
                                        icon: svg,
                                        marker: layerConfig.marker
                                    });
                                    var point = {
                                        type: "Point", coordinates: [record.cluster_center[1], record.cluster_center[0]]
                                    };
                                    service.bindTooltip(map, singleMarker, layerConfig, point);
                                    layerGroup.addLayer(singleMarker);
                                });
                            }(record));
                            //layerGroup.addLayer(new L.Marker(record.cluster_center)); // Uncomment to debug pointer alignment
                        } else {
                            var clusterValue = service.getClusterValue(record, layerConfig);
                            if (clusterValue !== null) {
                                var clusterMarker = new L.ClusterMarker(record.cluster_center, {
                                    geojson: record.cluster,
                                    value: service.getClusterValue(record, layerConfig),
                                    total: service.getClusterMax(data, layerConfig),
                                    color: layerConfig.color,
                                    numberFormattingFunction: service.formatNumber
                                });
                                service.bindZoomable(map, clusterMarker, layerConfig);
                                layerGroup.addLayer(clusterMarker);
                            }
                        }
                    }
                    deferred.resolve(layerGroup);
                });
                return deferred.promise;
            },
            buildHeatmapLayer: function(layerConfig, map, timeout) {
                var service = this;
                var deferred = $q.defer();
                var heatmapLayer = L.TileLayer.heatMap({
                    zIndex: 10,
                    radius: {
                        absolute: false,
                        value: 20
                    },
                    opacity: 0.8,
                    gradient: {
                        0.45: "rgb(0,0,255)",
                        0.55: "rgb(0,255,255)",
                        0.65: "rgb(0,255,0)",
                        0.95: "yellow",
                        1.0: "rgb(255,0,0)"
                    }
                });
                var parameters = angular.extend({}, layerConfig.context.parameters, {
                    'clustermode': 'heatmap',
                    'clusterdistance': 15,
                    'clusterprecision': map.getZoom(),
                    'geofilter.bbox': ODS.GeoFilter.getBoundsAsBboxParameter(map.getBounds())
                });

                if (layerConfig.func !== 'COUNT' && service.isAnalyzeEnabledClustering(layerConfig)) {
                    parameters['y.serie1.expr'] = layerConfig.expr;
                    parameters['y.serie1.func'] = layerConfig.func;
                }

                ODSAPI.records.geo(layerConfig.context, parameters, timeout.promise).success(function(data) {
                    // Display the clusters
                    var records = data.clusters;

                    heatmapLayer.options.radius.value = Math.min((1/data.clusters.length)*4000 + 20, 50);

                    var heatmapData = [];
                    for (var i=0; i<records.length; i++) {
                        var record = records[i];
                        var clusterValue = service.getClusterValue(record, layerConfig);
                        if (clusterValue !== null) {
                            heatmapData.push({
                                lat: record.cluster_center[0],
                                lon: record.cluster_center[1],
                                value: service.getClusterValue(record, layerConfig) - service.getClusterMin(data, layerConfig) + 1 // FIXME: the 1 should be proportional (and if the min is really 0 then it is false)
                            });
                        }
                    }
                    if (heatmapData.length > 0) {
                        heatmapLayer.setData(heatmapData);
                    }
                    deferred.resolve(heatmapLayer);
                });
                return deferred.promise;
            },
            buildAggregationLayer: function(layerConfig, map, timeout) {
                var service = this;
                var deferred = $q.defer();
                var shapeLayerGroup = new L.LayerGroup();

                // Either we self-join, or we join on a remote dataset
                // Remote requires:
                // - a remote dataset
                // - a local key, and optionally a remote key (else, assumes the remote is the local)
                var getShape, getItems, parameters;
                if (layerConfig.joinContext) {
                    // Remote!
                    var localKey = layerConfig.localKey;
                    var remoteKey = layerConfig.remoteKey;

                    if (!localKey || !remoteKey) {
                        console.error('An aggregation layer with a remote dataset requires a local-key and a remote-key');
                    }

                    var shapefields = layerConfig.joinContext.dataset.getFieldsForType('geo_shape');
                    if (!shapefields.length) {
                        console.error('You can only join an aggregation layer with a dataset that contains a geo_shape field.');
                    }
                    var shapefield = shapefields[0].name;
                    getShape = function(item) {
                        if (angular.isArray(item.x) && item.x[0].fields) {
                            return item.x[0].fields[shapefield];
                        } else {
                            return null;
                        }
                    };
                    getItems = function(rawResult) {
                        return rawResult.results;
                    };
                    var joinedFields = shapefield;
                    if (layerConfig.hoverField) {
                        joinedFields += ',' + layerConfig.hoverField
                    }
                    parameters = angular.extend({}, layerConfig.context.parameters, {
                        'clusterprecision': map.getZoom(),
                        'geofilter.bbox': ODS.GeoFilter.getBoundsAsBboxParameter(map.getBounds()),
                        'join.agg1.fields': joinedFields,
                        'join.agg1.remotedataset': layerConfig.joinContext.dataset.datasetid,
                        'join.agg1.remotekey': remoteKey,
                        'join.agg1.localkey': localKey,
                        'agg.agg1.func': 'MIN,MAX',
                        'agg.agg1.expr': 'serie1',
                        'y.serie1.expr': layerConfig.expr,
                        'y.serie1.func': layerConfig.func
                    });

                    ODSAPI.records.analyze(layerConfig.context, parameters, timeout.promise).success(handleResult);

                } else {
                    // Local
                    getShape = function(item) {
                        return item.cluster;
                    };
                    getItems = function(rawResult) {
                        return rawResult.clusters;
                    };

                    parameters = angular.extend({}, layerConfig.context.parameters, {
                        'clusterprecision': map.getZoom(),
                        'geofilter.bbox': ODS.GeoFilter.getBoundsAsBboxParameter(map.getBounds())
                    });

                    if (layerConfig.func !== 'COUNT' && service.isAnalyzeEnabledClustering(layerConfig)) {
                        parameters['y.serie1.expr'] = layerConfig.expr;
                        parameters['y.serie1.func'] = layerConfig.func;
                    }

                    ODSAPI.records.geopolygon(layerConfig.context, parameters, timeout.promise).success(handleResult);
                }

                function handleResult(rawResult) {
                    var records = getItems(rawResult);
                    if (records.length === 0) {
                        deferred.resolve(shapeLayerGroup);
                        return;
                    }
                    var min = service.getClusterMin(rawResult, layerConfig);
                    var max = service.getClusterMax(rawResult, layerConfig);
                    var values = service.getClusterValues(rawResult, layerConfig);

                    var colorScale = function(value) { return service.getColor(value, layerConfig, min, max, values.length); };

                    var geojsonOptions = {
                        radius: 3,
                        color: "#fff",
                        weight: 1,
                        opacity: 0.9,
                        fillOpacity: 0.5
                    };

                    // Legend is only supported for "scale" colors (we may implement it for "range" as well later)
                    if (!(angular.isObject(layerConfig.color) && layerConfig.color.type === 'range') && ((layerConfig.func !== 'COUNT' && service.isAnalyzeEnabledClustering(layerConfig)) || min !== max)) {
                        L.Legend = L.Control.extend({
                            initialize: function(options) {
                                L.Control.prototype.initialize.call(this, options);
                            },
                            onAdd: function(map) {
                                var grades = chroma.scale().domain([min, max], Math.min(10, values.length)).domain(),
                                    htmlContent = '';

                                var legendDiv = L.DomUtil.create('div', 'odswidget-map__legend');
                                var datasetTitle = layerConfig.context.dataset.datasetid;
                                var fieldName = layerConfig.expr;
                                //if ($scope.datasetSchemas && $scope.datasetSchemas[datasetConfig.datasetid]) {
                                    if (fieldName) {
                                        fieldName = layerConfig.context.dataset.getFieldLabel(layerConfig.expr);
                                    }
                                    datasetTitle = layerConfig.context.dataset.metas.title;
                                //}
                                htmlContent += '<div class="odswidget-map__legend-title">' + datasetTitle + '<br/>' + AggregationHelper.getFunctionLabel(layerConfig.func);
                                if (layerConfig.func !== 'COUNT') {
                                    htmlContent += ' ' + fieldName;
                                }
                                htmlContent += '</div>';
                                htmlContent += '<div class="odswidget-map__legend-colors">';
                                if (values.length === 1) {
                                    htmlContent += '<i class="color_0" style="width: 90%; background-color:' + colorScale((grades[0] + grades[1]) / 2) + '; opacity: 1;"></i>';
                                    htmlContent += '</div><div class="odswidget-map__legend-counts">';
                                    htmlContent += '<span class="odswidget-map__legend-value">';
                                    htmlContent += service.formatNumber(grades[0]);
                                    htmlContent += '</span>';
                                } else {
                                    var widthPercent = 90 / (grades.length - 1);
                                    // loop through our density intervals and generate a label with a colored square for each interval
                                    for (var i = 0; i < grades.length - 1; i++) {
                                        htmlContent += '<i class="odswidget-map__legend-color" style="width:' + widthPercent + '%; background-color:' + colorScale((grades[i] + grades[i + 1]) / 2) + '; opacity: 1;"></i>';
                                    }
                                    htmlContent += '</div><div>';
                                    htmlContent += '<span class="odswidget-map__legend-value">';
                                    htmlContent += service.formatNumber(grades[0]);
                                    htmlContent += '</span>';
                                    htmlContent += '<span class="odswidget-map__legend-value">';
                                    htmlContent += service.formatNumber(grades[grades.length - 1]);
                                    htmlContent += '</span>';
                                }
                                htmlContent += '</div>';

                                legendDiv.innerHTML = htmlContent;
                                return legendDiv;
                            }
                        });
                        var legend = new L.Legend({position: 'bottomleft'});
                        var addLegend = function(e) {
                            if (e.layer === shapeLayerGroup) {
                                map.addControl(legend);
                                map.off('layeradd', addLegend);
                            }
                        };
                        map.on('layeradd', addLegend);
                        var removeLegend = function(e) {
                            if (e.layer === shapeLayerGroup) {
                                map.removeControl(legend);
                                map.off('layerremove', removeLegend);
                            }
                        };
                        map.on('layerremove', removeLegend);
                    }

                    var bindMarkerOver = function(layerConfig, marker, record, recordid) {
                        marker.on('mouseover', function(e) {
                            var layer = e.target;
                            layer.setStyle({
                                weight: 2
                            });
                        });
                        marker.on('mouseout', function(e) {
                            var layer = e.target;
                            layer.setStyle({
                                weight: 1
                            });
                        });
                    };

                    for (var i=0; i < records.length; i++) {
                        var record = records[i];
                        var value = service.getClusterValue(record, layerConfig);
                        var shapeLayer, shape;
                        var pointToLayer = function (feature, latlng) { return L.circleMarker(latlng, geojsonOptions); };

                        if (value !== null) {
                            shape = getShape(record);
                            if (shape) {
                                shapeLayer = new L.GeoJSON(shape, {
                                    pointToLayer: pointToLayer,
                                    highlight: service.getColor(value, layerConfig, min, max, values.length),
                                    style: function (feature) {
                                        var opts = angular.copy(geojsonOptions);
                                        opts.fillColor = colorScale(value);
                                        if (angular.isDefined(layerConfig.opacity)) {
                                            opts.fillOpacity = layerConfig.opacity;
                                        }
                                        if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
                                            opts.weight = 5;
                                            opts.color = colorScale(value);
                                        } else {
                                            if (angular.isDefined(layerConfig.borderColor)) {
                                                opts.color = layerConfig.borderColor;
                                            }
                                        }
                                        return opts;
                                    }
                                });


                                if (shape.type !== 'LineString' && shape.type !== 'MultiLineString') {
                                    bindMarkerOver(layerConfig, shapeLayer, record, null);
                                }

                                if (layerConfig.joinContext && layerConfig.hoverField) {
                                    // Always show the value if it exists
                                    if (record.x[0].fields[layerConfig.hoverField]) {
                                        // TODO: We may want to make the value prettier (e.g. format number if it is one)
                                        shapeLayer.bindLabel(record.x[0].fields[layerConfig.hoverField]);
                                        if (layerConfig.refineOnClick) {
                                            service.bindTooltip(map, shapeLayer, layerConfig, shape, null, record.geo_digest, record.x[0].fields[layerConfig.hoverField]);
                                        }
                                    } else {
                                        if (layerConfig.refineOnClick) {
                                            service.bindTooltip(map, shapeLayer, layerConfig, shape, null, record.geo_digest);
                                        }
                                    }
                                } else {
                                    if ((layerConfig.func !== 'COUNT' && service.isAnalyzeEnabledClustering(layerConfig)) || min !== max) {
                                        shapeLayer.bindLabel(service.formatNumber(value));
                                    }
                                    if (layerConfig.refineOnClick) {
                                        // We're not sure yet what we want to show when we click on an aggregated shape, so we just handled
                                        // refine on click for now.
                                        service.bindTooltip(map, shapeLayer, layerConfig, shape, null, record.geo_digest);
                                    }
                                }
                                shapeLayerGroup.addLayer(shapeLayer);
                            }
                        }
                    }
                    deferred.resolve(shapeLayerGroup);
                }


                return deferred.promise;
            },
            buildShapePreviewLayer: function(layerConfig, map, timeout) {
                var service = this;
                var deferred = $q.defer();
                var parameters = angular.extend({}, layerConfig.context.parameters, {
                    'rows': 1000,
                    'clusterprecision': map.getZoom(),
                    'geofilter.bbox': ODS.GeoFilter.getBoundsAsBboxParameter(map.getBounds())
                });
                var layerGroup = new L.LayerGroup();
                ODSAPI.records.geopreview(layerConfig.context, parameters, timeout.promise).success(function(data) {
                    var shape;
                    for (var i = 0; i < data.length; i++) {
                        shape = data[i];
                        var geojsonOptions = {
                            radius: 3,
                            color: "#fff",
                            weight: 1,
                            opacity: 0.9,
                            fillOpacity: 0.5,
                            fillColor: layerConfig.color
                        };

                        var shapeLayer = new L.GeoJSON(shape.geometry, {
                            pointToLayer: function (feature, latlng) {
                                return L.circleMarker(latlng, geojsonOptions);
                            },
                            style: function(feature) {
                                var opts = angular.copy(geojsonOptions);
                                if (angular.isDefined(layerConfig.opacity)) {
                                    opts.fillOpacity = layerConfig.opacity;
                                }
                                if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
                                    opts.weight = 5;
                                    opts.color = layerConfig.color;
                                } else {
                                    if (angular.isDefined(layerConfig.borderColor)) {
                                        opts.color = layerConfig.borderColor;
                                    }
                                }
                                return opts;
                            }
                        });

                        layerGroup.addLayer(shapeLayer);
                        service.bindTooltip(map, shapeLayer, layerConfig, shape.geometry, null, shape.geo_digest);
                    }
                    deferred.resolve(layerGroup);
                });
                return deferred.promise;
            },
            getRecordColor: function(record, layerConfig) {
                // A record may only be colored if there is a configured field to color it from
                // Aggregation results may be colored from their values
                if (angular.isString(layerConfig.color)) {
                    return layerConfig.color;
                } else if (layerConfig.color.type === 'range') {
                    if (layerConfig.color.field) {
                        var value = record.fields[layerConfig.color.field];
                        if (angular.isUndefined(value)) {
                            return layerConfig.color.colors[0];
                        }
                        return this.getColor(value, layerConfig);
                    } else {
                        console.error('Range coloring requires a field');
                        return layerConfig.color.colors[0];
                    }
                    // TODO
                } else {
                    // Scale is not supported for records (yet?)
                    console.error('Scale coloring is not supported for simple records');
                    return chroma.scale(layerConfig.color.scale).out('hex').scale(0);
                }
            },
            getColor: function(value, layerConfig, min, max, scaleSteps) {
                scaleSteps = scaleSteps || 10;
                if (angular.isString(layerConfig.color)) {
                    if (angular.isDefined(min) && angular.isDefined(max)) {
                        return chroma.scale([chroma(layerConfig.color).brighten(50), layerConfig.color]).domain([min, max], Math.min(10, scaleSteps)).out('hex')(value);
                    } else {
                        // Simple color
                        return layerConfig.color;
                    }
                } else {
                    if (layerConfig.color.type === 'scale') {
                        return chroma.scale(layerConfig.color.scale).domain([min, max], Math.min(10, scaleSteps)).out('hex')(value);
                    } else if (layerConfig.color.type === 'range') {
                        var i;
                        for (i=0; i<layerConfig.color.ranges.length; i++) {
                            if (value < layerConfig.color.ranges[i]) {
                                return layerConfig.color.colors[i];
                            }
                        }
                        return layerConfig.color.colors[layerConfig.color.colors.length-1];
                    }
                }
            },
            /*                                  */
            /*          INTERACTIONS            */
            /*                                  */
            bindTooltip: function(map, feature, layerConfig, clusterShape, recordid, geoDigest, fieldValue) {
                var service = this;
                if (layerConfig.refineOnClick) {
                    feature.on('click', function(e) {
                        if (map.isDrawing) {
                            return;
                        }
                        // TODO: Support tiles and refineOnClick
                        service.refineContextOnClick(layerConfig, clusterShape, geoDigest, fieldValue);
                    });
                } else {
                    // Binds on a feature (marker, shape) so that it shows a popup on click
                    feature.on('click', function(e) {
                        if (map.isDrawing) {
                            return;
                        }
                        if (!clusterShape && !recordid && !geoDigest && !e.data) {
                            // An UTFGrid event with no grid data
                            return;
                        }
                        var latLng, yOffset;
                        if (angular.isDefined(e.target.getLatLng)) {
                            latLng = e.target.getLatLng();
                        } else {
                            latLng = e.latlng;
                            yOffset = 0; // Displayed where the user clicked
                        }
                        // FIXME: We assume that if the event contains a data, it is a gridData
                        service.showPopup(map, layerConfig, latLng, clusterShape, recordid, geoDigest, yOffset, e.data || null);
                    });
                }
            },
            refineContextOnClick: function(layerConfig, shape, digest, fieldValue) {
                var refineContext = function(refineConfig) {
                    var contextField = refineConfig.contextField;
                    var mapField = refineConfig.mapField;
                    var context = refineConfig.context;
                    var replaceRefine = refineConfig.replaceRefine;

                    if (!mapField && !contextField) {
                        $rootScope.$apply(function() {
                            // We are using the real shape so that we match anythinh within the shape
                            ODS.GeoFilter.addGeoFilterFromSpatialObject(context.parameters, shape);
                        });
                    } else {
                        if (angular.isDefined(fieldValue) && mapField == layerConfig.hoverField) {
                            $rootScope.$apply(function() {
                                context.toggleRefine(contextField, fieldValue, replaceRefine);
                            });
                        } else {
                            // We need to retrieve a record for this to work
                            // FIXME: Factorize with the same code just above
                            var options = {
                                format: 'json'
                            };
                            if (digest) {
                                options.geo_digest = digest;
                            } else {
                                ODS.GeoFilter.addGeoFilterFromSpatialObject(options, shape);
                            }
                            angular.extend(options, layerConfig.context.parameters, {rows: 1});
                            ODSAPI.records.download(layerConfig.context, options).success(function(data) {
                                if (angular.isDefined(data[0].fields[mapField])) {
                                    context.toggleRefine(contextField, data[0].fields[mapField], replaceRefine);
                                }
                            });
                        }
                    }
                };
                // This layer is configured to refine another context on click
                angular.forEach(layerConfig.refineOnClick, refineContext);
            },
            bindZoomable: function(map, feature, layerConfig) {
                // Binds on a feature (marker, shape) so that when clicked, it attemps to zoom on it, or show a regular
                // tooltip if at maximum zoom
                feature.on('click', function(e) {
                    if (map.isDrawing) {
                        return;
                    }
                    if (map.getZoom() === map.getMaxZoom()) {
                        this.showPopup(map, layerConfig, e.target.getLatLng(), e.target.getClusterShape());
                    } else {
                        map.setView(e.latlng, map.getZoom()+2);
                    }
                });
            },
            showPopup: function(map, layerConfig, latLng, shape, recordid, geoDigest, yOffset, gridData) {
                // TODO: How to pass custom template?
                // Displays a popup
                var newScope = $rootScope.$new(true);
                if (recordid) {
                    newScope.recordid = recordid;
                }
                if (shape) {
                    newScope.shape = shape;
                }
                if (gridData) {
                    newScope.gridData = gridData;
                }
                var dataset = layerConfig.context.dataset;
                newScope.map = map;
                newScope.template = layerConfig.tooltipTemplate || dataset.extra_metas && dataset.extra_metas.visualization && dataset.extra_metas.visualization.map_tooltip_html_enabled && dataset.extra_metas.visualization.map_tooltip_html || '';
                var popupOptions = {
                    offset: [0, angular.isDefined(yOffset) ? yOffset : -30],
                    maxWidth: 250,
                    minWidth: 250
                    //autoPanPaddingTopLeft: [50, 305]
                };
                newScope.context = layerConfig.context;
                // TODO: Move the custom template detection from the dataset inside odsMapTooltip? (the dataset object is available in the context)
                var popup = new L.Popup(popupOptions).setLatLng(latLng)
                    .setContent($compile('<ods-map-tooltip tooltip-sort="'+(layerConfig.tooltipSort||'')+'" shape="shape" recordid="recordid" context="context" map="map" template="{{ template }}" grid-data="gridData" geo-digest="'+(geoDigest||'')+'"></ods-map-tooltip>')(newScope)[0]);
                popup.openOn(map);
            },
            /*                              */
            /*          UTILITIES           */
            /*                              */
            formatNumber: function(number) {
                /* Passed as a callback for the cluster markers, to allow them to format their displayed value */
                // Limiting the digits
                number = Math.round(number*100)/100;
                // Formatting the digits
                number = $filter('number')(number);
                return number;
            },
            getClusterValue: function(cluster, layerConfig) {
                if (layerConfig.clusterMode === 'aggregation' && layerConfig.joinContext) {
                    // This is a join
                    return cluster.serie1;
                }

                if (layerConfig.func !== 'COUNT' && this.isAnalyzeEnabledClustering(layerConfig)) {
                    if (cluster.series) {
                        return cluster.series.serie1;
                    } else {
                        return null;
                    }
                } else {
                    return cluster.count;
                }
            },
            getClusterMin: function(apiResult, layerConfig) {
                if (layerConfig.clusterMode === 'aggregation' && layerConfig.joinContext) {
                    // This is a join
                    return apiResult.aggregations.agg1.min;
                }

                if (layerConfig.func !== 'COUNT' && this.isAnalyzeEnabledClustering(layerConfig)) {
                    return apiResult.series.serie1.min;
                } else {
                    return apiResult.count.min;
                }
            },
            getClusterMax: function(apiResult, layerConfig) {
                if (layerConfig.clusterMode === 'aggregation' && layerConfig.joinContext) {
                    // This is a join
                    return apiResult.aggregations.agg1.max;
                }

                if (layerConfig.func !== 'COUNT' && this.isAnalyzeEnabledClustering(layerConfig)) {
                    return apiResult.series.serie1.max;
                } else {
                    return apiResult.count.max;
                }
            },
            getClusterValues: function(apiResult, layerConfig) {
                var values = [], i;
                if (layerConfig.clusterMode === 'aggregation' && layerConfig.joinContext) {
                    // This is a join
                    for (i = 0; i < apiResult.results.length; i++) {
                        values.push(apiResult.results[i].serie1);
                    }
                } else if (layerConfig.func !== 'COUNT' && this.isAnalyzeEnabledClustering(layerConfig)) {
                    for (i = 0; i < apiResult.clusters.length; i++) {
                        if (apiResult.clusters[i].series) {
                            values.push(apiResult.clusters[i].series.serie1);
                        }
                    }
                } else {
                    for (i = 0; i < apiResult.clusters.length; i++) {
                        values.push(apiResult.clusters[i].count);
                    }
                }
                return values;
            },
            isAnalyzeEnabledClustering: function(layerConfig) {
                /* Are the analyze features enabled for this clustering? */
                return layerConfig.clusterMode === 'heatmap' || layerConfig.clusterMode === 'polygonforced' || layerConfig.clusterMode === 'shape' || layerConfig.clusterMode === 'aggregation';
            },
            doesLayerRefreshOnLocationChange: function(layerConfig) {
                if (layerConfig.clusterMode === 'tiles') {
                    return false;
                } else if ((layerConfig.clusterMode === 'shape' || layerConfig.clusterMode === 'aggregation') && layerConfig.joinContext) {
                    // We got all the data at once
                    return false;
                } else {
                    return true;
                }
            }
        };
    }]);
}());;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    var loading = {};
    var loaded = [];
    mod.provider('ModuleLazyLoader', function() {
        // We always load from https://, because if we don't put a scheme in the URL, local testing (from filesystem)
        // will look at file:// URLs and won't work.
        var lazyloading = {
            'highcharts': {
                'css': [],
                'js': [
                    ["https://code.highcharts.com/3.0.10/highcharts.js"],
                    ["https://code.highcharts.com/3.0.10/modules/no-data-to-display.js"],
                    ["https://code.highcharts.com/3.0.10/highcharts-more.js"],
                    ["https://code.highcharts.com/modules/treemap.js"]
                ]
            },
            'leaflet': {
                'css': [
                    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.3/leaflet.css",
                    "https://api.tiles.mapbox.com/mapbox.js/plugins/leaflet-fullscreen/v0.0.3/leaflet.fullscreen.css",
                    "https://api.tiles.mapbox.com/mapbox.js/plugins/leaflet-locatecontrol/v0.24.0/L.Control.Locate.css",
                    "libs/leaflet-control-geocoder/Control.Geocoder.css",
                    "libs/ods-vectormarker/vectormarker.css",
                    "libs/ods-clustermarker/clustermarker.css",
                    "libs/leaflet-label/leaflet.label.css",
                    "libs/leaflet-draw/leaflet.draw.css"
                ],
                'js': [
                    [
                        "L@https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.3/leaflet.js"
                    ],
                    [
                        "L.Control.FullScreen@https://api.tiles.mapbox.com/mapbox.js/plugins/leaflet-fullscreen/v0.0.3/Leaflet.fullscreen.min.js",
                        "L.Control.Locate@https://api.tiles.mapbox.com/mapbox.js/plugins/leaflet-locatecontrol/v0.24.0/L.Control.Locate.js",
                        "L.Label@libs/leaflet-label/leaflet.label.js",
                        "L.ODSMap@libs/ods-map/ods-map.js",
                        "L.ODSTileLayer@libs/ods-map/ods-tilelayer.js",
                        "L.Control.Geocoder@libs/leaflet-control-geocoder/Control.Geocoder.js",
                        "L.VectorMarker@libs/ods-vectormarker/vectormarker.js",
                        "L.ClusterMarker@libs/ods-clustermarker/clustermarker.js",
                        //"L.UtfGrid@libs/leaflet-utfgrid/leaflet.utfgrid.js",
                        "L.Draw@libs/leaflet-draw/leaflet.draw.js",
                        //"L.BundleTileLayer@libs/ods-bundletilelayer/bundletilelayer.js",
                        "QuadTree@libs/leaflet-heatmap/QuadTree.js",
                        "h337@libs/leaflet-heatmap/heatmap-backend.js",
                        "L.TileLayer.HeatMap@libs/leaflet-heatmap/heatmap-leaflet.js"
                    ]
                ]
            },
            'rome': {
                'css': ['libs/rome/rome.css'],
                'js': ['libs/rome/rome.standalone.js']
            },
            'fullcalendar': {
                'css': ['libs/fullcalendar/fullcalendar.min.css'],
                'js': [
                    'libs/fullcalendar/fullcalendar.min.js'
                ],
                'language_specific': {
                    'ar': {
                        'js': ['libs/fullcalendar/lang/ar.js']
                    },
                    'fr': {
                        'js': ['libs/fullcalendar/lang/fr.js']
                    },
                    'nl': {
                        'js': ['libs/fullcalendar/lang/nl.js']
                    }
                }
            },
            'qtip': {
                'css': ['libs/qtip/jquery.qtip.min.css'],
                'js': ['libs/qtip/jquery.qtip.min.js']
            }
        };

        this.getConfig = function() {
            return lazyloading;
        };

        var objectIsDefined = function(scope, name) {
            var nameParts = name.split('.');
            if (scope.hasOwnProperty(nameParts[0]) && angular.isDefined(scope[nameParts[0]])) {
                if (nameParts.length === 1) {
                    return true;
                } else {
                    var newScope = scope[nameParts[0]];
                    nameParts.shift();
                    return objectIsDefined(newScope, nameParts.join('.'));
                }
            } else {
                return false;
            }
        };

        var isAlreadyAvailable = function(objectName) {
            return objectIsDefined(window, objectName);
        };

        this.$get = ['$q', 'ODSWidgetsConfig', function($q, ODSWidgetsConfig) {
            var lazyload = function(type, url) {
                if (angular.isUndefined(loading[url])) {
                    var deferred = $q.defer();
                    loading[url] = deferred;
                    // If it is a relative URL, make it relative to ODSWidgetsConfig.basePath
                    var realURL =  url.substring(0, 1) === '/'
                                || url.substring(0, 7) === 'http://'
                                || url.substring(0, 8) === 'https://' ? url : ODSWidgetsConfig.basePath + url;
                    LazyLoad[type](realURL, function() {
                        deferred.resolve();
                        loaded.push(url);
                    });
                    loading[url] = deferred;
                }
                return loading[url];
            };

            var loadSequence = function(type, module, deferred, i) {
                var promises = [],
                    step;

                if (angular.isUndefined(i)) {
                    i = 0;
                }

                if (i >= module.length) {
                    deferred.resolve();
                } else {
                    step = module[i];
                    if (!angular.isArray(step)) {
                        step = [step];
                    }

                    for (var k = 0; k < step.length; k++) {
                        var parts = step[k].split('@');
                        var url;
                        if (parts.length > 1) {
                            // There is an object name whose existence we can check
                            if (isAlreadyAvailable(parts[0])) {
                                continue;
                            }
                            url = parts[1];
                        } else {
                            url = parts[0];
                        }

                        if (loaded.indexOf(url) === -1) {
                            promises.push(lazyload(type, url).promise);
                        } else {
                            promises.push(loading[url].promise);
                        }
                    }
                    $q.all(promises).then(function() {
                        loadSequence(type, module, deferred, i + 1);
                    });
                }

                return deferred.promise;
            };
            return function() {
                var promises = [];
                for (var i=0; i < arguments.length; i++) {
                    var module = lazyloading[arguments[i]];
                    // enrich module with language specific settings
                    if (module.language_specific && module.language_specific[ODSWidgetsConfig.language]) {
                        angular.forEach(module.language_specific[ODSWidgetsConfig.language], function (sources, type) {
                            if (module[type]) {
                                module[type] = module[type].concat(sources);
                            } else {
                                module[type] = sources;
                            }
                        });
                    }

                    if (module.css) {
                        promises.push(loadSequence('css', module.css, $q.defer()));
                    }
                    if (module.js) {
                        promises.push(loadSequence('js', module.js, $q.defer()));
                    }
                }
                return $q.all(promises);
            };
        }];
    });

    mod.factory("DebugLogger", ['$window', function($window) {
        // TODO: Don't duplicate our own DebugLogger
        return {
            log: function() {
                if ($window.location.hash == '#debug' || $window.location.hash.indexOf('debug=') >= 0 || $(document.body).hasClass('showDebug')) {
                    console.log.apply(console, arguments);
                }
            }
        };
    }]);

    mod.factory("odsErrorService", function() {
        var notificationList = [];
        return {
            registerForErrorNotification: function(callback) {
                notificationList.push(callback);
            },
            sendErrorNotification: function(error) {
                if (angular.isString(error)) {
                    error = {
                        title: 'Error',
                        error: error
                    };
                }
                angular.forEach(notificationList, function(callback) {
                    callback(error);
                });
            },
            markErrorAsHandled: function(error) {
                error.handled = true;
            }
        };
    });

    mod.provider('SVGInliner', function() {
        /*
        var element = SVGInliner(url);
         */
        var inlineImages = {};

        // This is the SVG used when the URLs raises a 404
        var FALLBACK = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>' +
            '<svg id="dot-icon" width="19px" height="19px" viewBox="0 0 19 19" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns:sketch="http://www.bohemiancoding.com/sketch/ns">' +
            '    <path d="M13,9.50004202 C13,11.4330618 11.4329777,13.000084 9.49995798,13.000084 C7.56693813,13.000084 5.99991595,11.4330618 5.99991595,9.50004202 C5.99991595,7.56702218 7.56693813,6 9.49995798,6 C11.4329777,6 13,7.56702218 13,9.50004202 L13,9.50004202 Z" id="path8568" fill="#000000"></path>' +
            '    <rect style="opacity: 0" x="0" y="0" width="19" height="19"></rect>' +
            '</svg>';

        var loadImageInline = function(element, code, color) {
            var svg = angular.element(code);
            if (color) {
                svg.css('fill', color);
                svg.find('path, polygon, circle, rect, text').css('fill', color); // Needed for our legacy SVGs of various quality...
            }
            element.append(svg);
        };

        this.$get = ['$http', '$q', function($http, $q) {
            var retrieve = function(url, color, getPromise) {
                var deferred;
                if (getPromise) {
                    deferred = $q.defer();
                }
                var element = angular.element('<div class="ods-svginliner__svg-container"></div>');
                if (!url) {
                    loadImageInline(element, FALLBACK, color);
                    if (getPromise) { deferred.resolve(element); }
                } else if (url.indexOf('.svg') === -1) {
                    // Normal image
                    element.append(angular.element('<img src="' + url + '"/>'));
                    if (getPromise) { deferred.resolve(element); }
                } else {
                    // SVG
                    if (inlineImages[url]) {
                        if (inlineImages[url].code) {
                            loadImageInline(element, inlineImages[url].code, color);
                            if (getPromise) { deferred.resolve(element); }
                        } else {
                            inlineImages[url].promise.success(function (data) {
                                loadImageInline(element, data, color);
                                if (getPromise) { deferred.resolve(element); }
                            }).error(function() {
                                loadImageInline(element, FALLBACK, color);
                                if (getPromise) { deferred.resolve(element); }
                            });
                        }

                    } else {
                        var promise = $http.get(url);
                        inlineImages[url] = {promise: promise};
                        promise.success(function (data) {
                            inlineImages[url].code = data;
                            loadImageInline(element, data, color);
                            if (getPromise) { deferred.resolve(element); }
                        }).error(function(data, status) {
                            // Ignore it silently
                            console.log('WARNING: Unable to fetch SVG image', url, 'HTTP status:', status);
                            inlineImages[url].code = FALLBACK;
                            loadImageInline(element, FALLBACK, color);
                            if (getPromise) { deferred.resolve(element); }
                        });
                    }
                }
                if (getPromise) {
                    return deferred.promise;
                } else {
                    return element;
                }
            };

            return {
                getElement: function(url, color) {
                    return retrieve(url, color);
                },
                getPromise: function(url, color) {
                    return retrieve(url, color, true);
                }
            };

        }];
    });

    mod.service('PictoHelper', function() {
        var FONTAWESOME_3_TO_4 = {
            'ban-circle': 'ban',
            'bar-chart': 'bar-chart-o',
            'beaker': 'flask',
            'bell': 'bell-o',
            'bell-alt': 'bell',
            'bitbucket-sign': 'bitbucket-square',
            'bookmark-empty': 'bookmark-o',
            'building': 'building-o (4.0.2)',
            'calendar-empty': 'calendar-o',
            'check-empty': 'square-o',
            'check-minus': 'minus-square-o',
            'check-sign': 'check-square',
            'check': 'check-square-o',
            'chevron-sign-down': 'chevron-down',
            'chevron-sign-left': 'chevron-left',
            'chevron-sign-right': 'chevron-right',
            'chevron-sign-up': 'chevron-up',
            'circle-arrow-down': 'arrow-circle-down',
            'circle-arrow-left': 'arrow-circle-left',
            'circle-arrow-right': 'arrow-circle-right',
            'circle-arrow-up': 'arrow-circle-up',
            'circle-blank': 'circle-o',
            'cny': 'rub',
            'collapse-alt': 'minus-square-o',
            'collapse-top': 'caret-square-o-up',
            'collapse': 'caret-square-o-down',
            'comment-alt': 'comment-o',
            'comments-alt': 'comments-o',
            'copy': 'files-o',
            'cut': 'scissors',
            'dashboard': 'tachometer',
            'double-angle-down': 'angle-double-down',
            'double-angle-left': 'angle-double-left',
            'double-angle-right': 'angle-double-right',
            'double-angle-up': 'angle-double-up',
            'download': 'arrow-circle-o-down',
            'download-alt': 'download',
            'edit-sign': 'pencil-square',
            'edit': 'pencil-square-o',
            'ellipsis-horizontal': 'ellipsis-h (4.0.2)',
            'ellipsis-vertical': 'ellipsis-v (4.0.2)',
            'envelope-alt': 'envelope-o',
            'euro': 'eur',
            'exclamation-sign': 'exclamation-circle',
            'expand-alt': 'plus-square-o (4.0.2)',
            'expand': 'caret-square-o-right',
            'external-link-sign': 'external-link-square',
            'eye-close': 'eye-slash',
            'eye-open': 'eye',
            'facebook-sign': 'facebook-square',
            'facetime-video': 'video-camera',
            'file-alt': 'file-o',
            'file-text-alt': 'file-text-o',
            'flag-alt': 'flag-o',
            'folder-close-alt': 'folder-o',
            'folder-close': 'folder',
            'folder-open-alt': 'folder-open-o',
            'food': 'cutlery',
            'frown': 'frown-o',
            'fullscreen': 'arrows-alt (4.0.2)',
            'github-sign': 'github-square',
            'google-plus-sign': 'google-plus-square',
            'group': 'users (4.0.2)',
            'h-sign': 'h-square',
            'hand-down': 'hand-o-down',
            'hand-left': 'hand-o-left',
            'hand-right': 'hand-o-right',
            'hand-up': 'hand-o-up',
            'hdd': 'hdd-o (4.0.1)',
            'heart-empty': 'heart-o',
            'hospital': 'hospital-o (4.0.2)',
            'indent-left': 'outdent',
            'indent-right': 'indent',
            'info-sign': 'info-circle',
            'keyboard': 'keyboard-o',
            'legal': 'gavel',
            'lemon': 'lemon-o',
            'lightbulb': 'lightbulb-o',
            'linkedin-sign': 'linkedin-square',
            'meh': 'meh-o',
            'microphone-off': 'microphone-slash',
            'minus-sign-alt': 'minus-square',
            'minus-sign': 'minus-circle',
            'mobile-phone': 'mobile',
            'moon': 'moon-o',
            'move': 'arrows (4.0.2)',
            'off': 'power-off',
            'ok-circle': 'check-circle-o',
            'ok-sign': 'check-circle',
            'ok': 'check',
            'paper-clip': 'paperclip',
            'paste': 'clipboard',
            'phone-sign': 'phone-square',
            'picture': 'picture-o',
            'pinterest-sign': 'pinterest-square',
            'play-circle': 'play-circle-o',
            'play-sign': 'play-circle',
            'plus-sign-alt': 'plus-square',
            'plus-sign': 'plus-circle',
            'pushpin': 'thumb-tack',
            'question-sign': 'question-circle',
            'remove-circle': 'times-circle-o',
            'remove-sign': 'times-circle',
            'remove': 'times',
            'reorder': 'bars (4.0.2)',
            'resize-full': 'expand (4.0.2)',
            'resize-horizontal': 'arrows-h (4.0.2)',
            'resize-small': 'compress (4.0.2)',
            'resize-vertical': 'arrows-v (4.0.2)',
            'rss-sign': 'rss-square',
            'save': 'floppy-o',
            'screenshot': 'crosshairs',
            'share-alt': 'share',
            'share-sign': 'share-square',
            'share': 'share-square-o',
            'sign-blank': 'square',
            'signin': 'sign-in',
            'signout': 'sign-out',
            'smile': 'smile-o',
            'sort-by-alphabet-alt': 'sort-alpha-desc',
            'sort-by-alphabet': 'sort-alpha-asc',
            'sort-by-attributes-alt': 'sort-amount-desc',
            'sort-by-attributes': 'sort-amount-asc',
            'sort-by-order-alt': 'sort-numeric-desc',
            'sort-by-order': 'sort-numeric-asc',
            'sort-down': 'sort-desc',
            'sort-up': 'sort-asc',
            'stackexchange': 'stack-overflow',
            'star-empty': 'star-o',
            'star-half-empty': 'star-half-o',
            'sun': 'sun-o',
            'thumbs-down-alt': 'thumbs-o-down',
            'thumbs-up-alt': 'thumbs-o-up',
            'time': 'clock-o',
            'trash': 'trash-o',
            'tumblr-sign': 'tumblr-square',
            'twitter-sign': 'twitter-square',
            'unlink': 'chain-broken',
            'upload': 'arrow-circle-o-up',
            'upload-alt': 'upload',
            'warning-sign': 'exclamation-triangle',
            'xing-sign': 'xing-square',
            'youtube-sign': 'youtube-square',
            'zoom-in': 'search-plus',
            'zoom-out': 'search-minus'
        };

        return {
            mapPictoToURL: function(picto, context) {
                if (!picto) {
                    return null;
                }
                var url = context && context.domainUrl || '';
                if (picto.startsWith('icon-')) {
                    // Old icon set (v1), from fontawesome 3.2.1
                    var pictoName = picto.replace('icon-', '');
                    if (FONTAWESOME_3_TO_4[pictoName]) {
                        pictoName = FONTAWESOME_3_TO_4[pictoName];
                    }
                    url += '/static/pictos/img/set-v1/fa/' + pictoName + '.svg';
                } else if (picto.startsWith('pdpicto-') || picto.startsWith('odspicto-')) {
                    // Legacy - old picto set
                    picto = picto.replace('pdpicto-', 'pdpicto/').replace('odspicto-', 'odspicto/');
                    url += '/static/pictos/img/set-v1/' + picto + '.svg';
                } else {
                    // New picto set
                    url += '/static/pictos/img/set-v2/' + picto + '.svg';
                }
                return url;
            }
        };
    });

    mod.factory('URLSynchronizer', ['$location', '$document', function($location, $document) {
        /*
        This service handles the synchronization of the querystring in the browser's URL, and specific JavaScript objects.

        The point of this service is to handle the frequent need to store in the URL the content of an object, typically
        API parameters. This gives the ability to copy the URL at any point, and open it in another browser with the same state.
        The service can be used to watch a given object in a given scope, and reproduce its content in the URL, and vice versa.

        The service uses $location.search to ensure we do things in an "Angularic" way, and gives us theoric ability to switch
        to HTML5 when we want.

        You can register any number of JSONObject, but only one regular object that will gather all the non-JSON parameters.
         */
        var suspended = false;
        var syncers = [];

        // Waiting for the day the prefixes are gone
        $document.bind('webkitfullscreenchange mozfullscreenchange ofullscreenchange msfullscreenchange khtmlfullscreenchange', function() {
            var fullscreenElement = document.fullscreenElement || document.mozFullScreenElement || document.webkitFullscreenElement;
            if (fullscreenElement) {
                // Stop replicating
                suspended = true;
            } else {
                suspended = false;

                // Apply at once
                for (var i=0; i<syncers.length; i++) {
                    syncers[i]();
                }
            }
        });
        var ignoreList = [];
        return {
            addSynchronizedValue: function(scope, objName, urlName, skipHistory) {
                ignoreList.push(objName);
                if (urlName) {
                    ignoreList.push(urlName);
                }
                var urlValue = $location.search()[urlName || objName];
                scope.$eval(objName + '=newObj', {newObj: urlValue});

                var sync = function() {
                    // Watching the object to sync the changes to URL
                    var val = scope.$eval(objName);
                    if (skipHistory) {
                        $location.replace();
                    }
                    $location.search(urlName || objName,val);
                };
                var unwatchObject = scope.$watch(objName, function(nv, ov) {
                    if (!suspended) {
                        sync();
                    }
                }, true);

                syncers.push(sync);

                var unwatchLocation = scope.$watch(function() { return $location.search()[urlName || objName]; }, function(nv, ov) {
                    // Watching URL param to sync to object
                    if (nv){
                        scope.$eval(objName + '=newObj', {newObj: nv});
                    }
                }, true);

                return function unwatch() {
                    unwatchObject();
                    unwatchLocation();
                };
            },
            addJSONSynchronizedObject: function(scope, objName, urlName) {
                // Upon first call, the URLparams  erases the current object
                ignoreList.push(urlName || objName);
                var urlValue = $location.search()[urlName || objName];
                if(urlValue){
                    // does it starts with a {  ?
                    if(urlValue[0] === '{' ){
                        // old format ?
                        scope.$eval(objName + '=newObj', {newObj: JSON.parse(urlValue)});
                    } else {
                        // new format
                        scope.$eval(objName + '=newObj', {newObj: JSON.parse(b64_to_utf8(urlValue))});
                    }
                }

                var last_serialization;
                var sync = function() {
                    // Watching the object to sync the changes to URL
                    var val = scope.$eval(objName);
                    if (typeof val === "undefined") {
                        val = "";
                    }
                    last_serialization = utf8_to_b64(angular.toJson(val));
                    $location.search(urlName || objName, last_serialization);
                };

                syncers.push(sync);
                var unwatch = scope.$watch(function() { return [scope.$eval(objName), $location.search()[urlName || objName]]; }, function(nv, ov) {
                    if (typeof nv[0] === "undefined") {
                        nv[0] = "";
                    }
                    if (last_serialization !== utf8_to_b64(angular.toJson(nv[0])) && !suspended) {
                        // sync to url if object has changed since last sync
                        sync();
                    } else if (last_serialization !== nv[1] && nv[1]) {
                        // else if something changed in the url, push it to the object
                        scope.$eval(function(scope) {
                            scope[objName] = JSON.parse(b64_to_utf8(nv[1]));
                        });
                    }
                }, true);

                return unwatch;
            },
            addSynchronizedObject: function(scope, objName, localObjectIgnoreList) {
                // Add an object as a synchronized object, meaning its content will be synchronized with the querystring.
                localObjectIgnoreList = localObjectIgnoreList || [];

                var syncFromURL = function() {
                    // Watching URL params to sync to object
                    var nv = angular.copy($location.search());
                    angular.forEach(nv, function(value, key){
                        // preserve ignored values
                        if(ignoreList.indexOf(key) >= 0){
                            delete nv[key];
                        }
                    });
                    if (localObjectIgnoreList.length > 0) {
                        var oldVal = scope.$eval(objName);
                        angular.forEach(localObjectIgnoreList, function(name) {
                            // We need to keep this parameter
                            if (angular.isDefined(oldVal[name])) {
                                nv[name] = oldVal[name];
                            }
                        });
                    }
                    scope.$eval(objName + '=newVal', {newVal: nv});
                };

                var syncToURL = function() {
                    var val = angular.copy(scope.$eval(objName));
                    angular.forEach(localObjectIgnoreList, function(name) {
                        // Don't send in the URL this parameters
                        if (angular.isDefined(val[name])) {
                            delete val[name];
                        }
                    });
                    angular.forEach($location.search(), function(value, key){
                        // Preserve ignored values that already exist in the URL:
                        // - from ignoreList, which is the list of values handled by other URLSync's
                        // - from localObjectIgnoreList, which is the list of object properties that we want to ignore
                        //   (both ways)
                        if(ignoreList.indexOf(key) >= 0 || localObjectIgnoreList.indexOf(key) >= 0){
                            val[key] = value;
                        }
                    });
                    $location.search(val);
                };

                // Upon first call, the URLparams  erases the current object
                syncFromURL();

                var unwatchObject = scope.$watch(objName, function(nv, ov) {
                    if (!suspended) {
                        // Watching the object to sync the changes to URL
                        syncToURL();
                    }
                }, true);

                syncers.push(syncToURL);


                var unwatchLocation = scope.$watch(function() { return $location.search(); }, syncFromURL, true);

                return function unwatch() {
                    unwatchObject();
                    unwatchLocation();
                };
            }
        };
    }]);
}());;(function() {
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
}());;(function() {
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

}());;(function(target) {
    var ODS = {
        Context: {
            toggleRefine: function(context, facetName, path, replace) {
                var refineKey = 'refine.'+facetName;
                if (angular.isDefined(context.parameters[refineKey])) {
                    // There is at least one refine already
                    var refines = angular.copy(context.parameters[refineKey]);
                    if (!angular.isArray(refines)) {
                        refines = [refines];
                    }

                    if (refines.indexOf(path) > -1) {
                        // Remove the refinement
                        refines.splice(refines.indexOf(path), 1);
                    } else {
                        // Activate
                        angular.forEach(refines, function(refine, idx) {
                            if (path.startsWith(refine+'/')) {
                                // This already active refine is less precise than the new one, we remove it
                                refines.splice(idx, 1);
                            } else if (refine.startsWith(path+'/')) {
                                // This already active refine is more precise than the new one, we remove it
                                refines.splice(idx, 1);
                            }
                        });
                        if (angular.isUndefined(replace) || replace === false) {
                            refines.push(path);
                        } else {
                            refines = [path];
                        }
                    }

                    if (refines.length === 0) {
                        delete context.parameters[refineKey];
                    } else {
                        context.parameters[refineKey] = refines;
                    }
                } else {
                    context.parameters[refineKey] = path;
                }
            }
        },
        GeoFilter: {
            /*
            Types of parameters:
                Bbox: Lat-SW,Lng-SW,Lat-NE,Lng-NE
                    e.g.: "43.14,12.62642,41.32,14.63"
                Polygon: a string of a list of lat,lng fit for geofilter.polygon
                    e.g.: "(48.92994318778139,2.1636199951171875),(48.92994318778139,2.5100326538085938),(48.79125929678568,2.5100326538085938),(48.79125929678568,2.1636199951171875)"
                Bounds: an object fit for leaflet's LatLngBounds objects, typically an array of arrays
                    e.g.: [ [43.14, 12.62642], [41.32, 14.63] ]
            */
            getBboxParameterAsBounds: function(bounds) {
                /*  Input: a Bbox
                    Output: a Bounds
                 */
                var members = bounds.split(',');
                return [
                    [ members[0], members[1] ],
                    [ members[2], members[3] ]
                ];
            },
            getBoundsAsBboxParameter: function(bounds) {
                /*  Input: a Bounds
                    Output: a Bbox
                */
                if (angular.isArray(bounds)) {
                    return [ bounds[0][0], bounds[0][1], bounds[1][0], bounds[1][1] ].join(',');
                } else {
                    return [ bounds.getSouthWest().lat, bounds.getSouthWest().lng, bounds.getNorthEast().lat, bounds.getNorthEast().lng ].join(',');
                }
            },
            getBoundsAsPolygonParameter: function(bounds) {
                /*  Input: a Bounds
                    Output: a Polygon
                */
                var leafletBounds;
                if (angular.isArray(bounds)) {
                    leafletBounds = new L.LatLngBounds(bounds);
                } else {
                    leafletBounds = bounds;
                }
                var polygon = [
                    [ leafletBounds.getNorthWest().lat, leafletBounds.getNorthWest().lng ],
                    [ leafletBounds.getNorthEast().lat, leafletBounds.getNorthEast().lng ],
                    [ leafletBounds.getSouthEast().lat, leafletBounds.getSouthEast().lng ],
                    [ leafletBounds.getSouthWest().lat, leafletBounds.getSouthWest().lng ]
                ];
                var polygonBounds = [];
                for (var i=0; i<polygon.length; i++) {
                    var bound = polygon[i];
                    polygonBounds.push(bound.join(','));
                }
                var param = '('+polygonBounds.join('),(')+')';
                return param;
            },
            getPolygonParameterAsBounds: function(parameter) {
                /*  Input: a Polygon
                    Output: a Bounds
                */
                var members = parameter.replace(/[()]/g, '').split(',');
                var minlat, minlng, maxlat, maxlng;
                for (var i=0; i<members.length; i+=2) {
                    var lat = parseFloat(members[i]);
                    var lng = parseFloat(members[i+1]);

                    if (!minlat || minlat > lat) { minlat = lat; }
                    if (!minlng || minlng > lng) { minlng = lng; }
                    if (!maxlat || maxlat < lat) { maxlat = lat; }
                    if (!maxlng || maxlng < lng) { maxlng = lng; }
                }
                return [
                    [ minlat, minlng ],
                    [ maxlat, maxlng ]
                ];
            },
            getPolygonParameterAsGeoJSON: function(parameter) {
                var geojson = {
                    'type': 'Polygon',
                    'coordinates': [[]]
                };
                var members = parameter.replace(/[()]/g, '').split(',');
                for (var i=0; i<members.length; i+=2) {
                    var lat = parseFloat(members[i]);
                    var lng = parseFloat(members[i + 1]);
                    geojson.coordinates[0].push([lng, lat]);
                }
                return geojson;
            },
            getBboxParameterAsPolygonParameter: function(bbox) {
                /*  Input: a Bbox
                    Output: a Polygon
                */
                return this.getBoundsAsPolygonParameter(this.getBboxParameterAsBounds(bbox));
            },
            getGeoJSONPolygonAsPolygonParameter: function(geoJsonPolygon) {
                /*  Input: a GeoJSON object of type Polygon
                    Output: a Polygon
                 */
                var coordinates;
                var polygonBounds = [];
                if (geoJsonPolygon.type === 'LineString') {
                    // Currently our API doesn't have a geofilter system that supports querying as a line, so we
                    // query its bounding box instead
                    coordinates = geoJsonPolygon.coordinates;

                    // Let's compute the boundingbox
                    var minLng = null,
                        minLat = null,
                        maxLng = null,
                        maxLat = null;
                    angular.forEach(coordinates, function(pos) {
                        // GeoJSON is lng,lat
                        var lng = pos[0],
                            lat = pos[1];

                        minLng = minLng === null ? lng : Math.min(minLng, lng);
                        minLat = minLat === null ? lat : Math.min(minLat, lat);
                        maxLng = maxLng === null ? lng : Math.max(maxLng, lng);
                        maxLat = maxLat === null ? lat : Math.max(maxLat, lat);
                    });

                    polygonBounds.push(minLat + ',' + minLng);
                    polygonBounds.push(minLat + ',' + maxLng);
                    polygonBounds.push(maxLat + ',' + maxLng);
                    polygonBounds.push(maxLat + ',' + minLng);
                } else {
                    // We are only working on the first set of coordinates
                    coordinates = geoJsonPolygon.coordinates[0];
                    // For MutliPolygon, we are only working on the first polygon
                    if (geoJsonPolygon.type === 'MultiPolygon') {
                        coordinates = coordinates[0];
                    }
                    for (var i=0; i<coordinates.length; i++) {
                        var bound = angular.copy(coordinates[i]);
                        if (bound.length > 2) {
                            // Discard the z
                            bound.splice(2, 1);
                        }
                        bound.reverse(); // GeoJSON has reverse coordinates from the rest of us
                        polygonBounds.push(bound.join(','));
                    }
                }
                return '('+polygonBounds.join('),(')+')';
            },
            addGeoFilterFromSpatialObject: function(parameters, spatial) {
                /*  Input: Either a GeoJSON or an array of lat,lng
                    Output: Nothing (it adds the new geofilter in place)
                 */
                if (angular.isArray(spatial)) {
                    // 2D coordinates (lat, lng)
                    parameters["geofilter.distance"] = spatial[0]+','+spatial[1];
                } else if (spatial.type === 'Point') {
                    parameters["geofilter.distance"] = spatial.coordinates[1]+','+spatial.coordinates[0];
                } else {
                   parameters["geofilter.polygon"] = this.getGeoJSONPolygonAsPolygonParameter(spatial);
                }
            }
        },
        StringUtils: {
            slugify: function(string) {
                if (!string) {
                    return string;
                }
                return string
                    .toLowerCase()
                    .replace(/\s+/g,'-')
                    .replace(/[^\w-]+/g,'')
                    .replace(/-+/g,'-');
            },
            capitalize: function(input) {
                return input.charAt(0).toUpperCase() + input.slice(1);
            },
            startsWith: function(input, searchedString) {
                return input && input.indexOf(searchedString) === 0;
            },
            escapeHTML: function(text) {
                return text
                     .replace(/&/g, "&amp;")
                     .replace(/</g, "&lt;")
                     .replace(/>/g, "&gt;")
                     .replace(/"/g, "&quot;")
                     .replace(/'/g, "&#039;");
            }
        },
        ArrayUtils: {
            transpose: function(input) {
                if (angular.isArray(input)) {
                    return input.reduce(function (resultObject, key) {
                        resultObject[key] = true;
                        return resultObject;
                    }, {});
                } else {
                    return Object.keys(input).reduce(function (resultArray, key) {
                        if (input[key]) {
                            resultArray.push(key);
                        }
                        return resultArray;
                    }, []);
                }
            }
        },
        URLUtils: {
            cleanupAPIParams: function(params) {
                var params = angular.copy(params);

                function unnameParameter(prefix, parameterName, parameterValue) {
                    // Transforms a "named" parameter (e.g. q.myname) to put its value into the unnamed base parameter (q)
                    if (parameterName.startsWith(prefix+'.')) {
                        if (!params[prefix]) {
                            params[prefix] = parameterValue;
                        } else if (angular.isArray(params[prefix])) {
                            params[prefix].push(parameterValue);
                        } else {
                            params[prefix] = [params[prefix], parameterValue];
                        }
                        delete params[parameterName];
                    }
                }

                // Transforming named parameters into regular parameters... until the API supports it itself
                angular.forEach(params, function(paramValue, paramName) {
                    angular.forEach(['q', 'rq'], function(prefix) {
                        unnameParameter(prefix, paramName, paramValue);
                    });
                });
                return params;
            },
            getAPIQueryString: function(options) {
                var qs = [];
                options = this.cleanupAPIParams(options);
                angular.forEach(options, function(value, key) {
                    if (angular.isString(value)) {
                        qs.push(key+'='+encodeURIComponent(value));
                    } else {
                        angular.forEach(value, function(singleVal) {
                            qs.push(key+'='+encodeURIComponent(singleVal));
                        });
                    }
                });
                return qs.join('&');
            }
        },
        DatasetUtils: {
            isFieldSortable: function(field) {
                // This is in a separate function because it can be used independently from the dataset
                var supportedSortTypes = ['int', 'double', 'date', 'datetime'];
                if (supportedSortTypes.indexOf(field.type) >= 0) {
                    // These types are always sortable
                    return true;
                }
                if (field.type === 'text' && field.annotations) {
                    for (var a=0; a<field.annotations.length; a++) {
                        var anno = field.annotations[a];
                        if (anno.name === 'sortable') {
                            return true;
                        }
                    }
                }
                return false;
            }
        },
        Dataset: function(dataset) {
            var types, facetsCount, filtersDescription;

            var isFieldAnnotated = function(field, annotationName) {
                if (field.annotations) {
                    for (var i=0; i<field.annotations.length; i++) {
                        if (field.annotations[i].name === annotationName) {
                            return true;
                        }
                    }
                }
                return false;
            };

            var iterateFields = function(fields) {
                filtersDescription = {'facets': []};
                types = [];
                facetsCount = 0;
                for (var j=0; j< fields.length; j++) {
                    var field = fields[j];
                    if (isFieldAnnotated(field, 'facet')) {
                        facetsCount++;
                        filtersDescription.facets.push(field);
                    }
                    if (!types[field.type]) {
                        types[field.type] = 1;
                    } else {
                        types[field.type] += 1;
                    }
                }
            };

            return {
                datasetid: dataset.datasetid || "preview", // "preview" is here as a trick in publish as the dataset has no id
                has_records: dataset.has_records,
                metas: dataset.metas || {domain: 'preview'},
                features: dataset.features,
                attachments: dataset.attachments,
                alternative_exports: dataset.alternative_exports,
                fields: dataset.fields,
                extra_metas: dataset.extra_metas,
                interop_metas: dataset.interop_metas,
                billing_plans: dataset.billing_plans,
                setFields: function(fields) {
                    this.fields = fields;
                    iterateFields(this.fields);
                },
                getUniqueId: function() {
                    return this.metas.domain + '.' + this.datasetid;
                },
                getTypes: function() {
                    if (typeof types === "undefined") {
                        iterateFields(this.fields);
                    }
                    return types;
                },
                hasFeature: function(featureName) {
                    return (dataset.features.indexOf(featureName) > -1);
                },
                hasFieldType: function(fieldType) {
                    for (var i = 0; i < this.fields.length; i++) {
                        if (this.fields[i].type == fieldType) {
                            return true;
                        }
                    }
                    return false;
                },
                countFieldType: function (fieldType) {
                    var count = 0;
                    for (var i = 0; i < this.fields.length; i++) {
                        if (this.fields[i].type == fieldType) {
                            count++;
                        }
                    }
                    return count;
                },
                countFieldTypes: function (fieldTypes) {
                    var count = 0;
                    for (var i = 0; i < fieldTypes.length; i++) {
                        count += this.countFieldType(fieldTypes[i]);
                    }
                    return count;
                },
                getFacetsCount: function() {
                    if (typeof facetsCount === "undefined") {
                        iterateFields(this.fields);
                    }
                    return facetsCount;
                },
                hasFacet: function() {
                    if (typeof facetsCount === "undefined") {
                        iterateFields(this.fields);
                    }
                    return facetsCount > 0;
                },
                getFilterDescription: function() {
                    if (typeof filtersDescription === "undefined") {
                        iterateFields(this.fields);
                    }
                    return filtersDescription;
                },
                getFacets: function() {
                    return this.getFilterDescription().facets;
                },
                setMetas: function(metas) {
                    this.metas = metas;
                },
                getField: function(fieldName) {
                    for (var i=0; i<this.fields.length; i++) {
                        var field = this.fields[i];
                        if (field.name === fieldName) {
                            return field;
                        }
                    }
                    return null;
                },
                getFieldLabel: function(fieldName) {
                    var field = this.getField(fieldName);
                    if (!field) {
                        return field;
                    }
                    return field.label;
                },
                getFieldsForType: function(fieldType) {
                    var fields = [];
                    for (var i=0; i<this.fields.length; i++) {
                        var field = this.fields[i];
                        if (field.type === fieldType) {
                            fields.push(field);
                        }
                    }
                    return fields;
                },
                hasNumericField: function() {
                    for (var i=0; i < this.fields.length; i++) {
                        var field = this.fields[i];
                        if (field.type === 'int' || field.type === 'double') {
                            return true;
                        }
                    }
                    return false;
                },
                hasGeoField: function() {
                    for (var i=0; i < this.fields.length; i++) {
                        var field = this.fields[i];
                        if (field.type === 'geo_point_2d' || field.type === 'geo_shape') {
                            return true;
                        }
                    }
                    return false;
                },
                getExtraMeta: function(template, name) {
                    if (this.extra_metas && this.extra_metas[template] && this.extra_metas[template][name]) {
                        return this.extra_metas[template][name];
                    } else {
                        return null;
                    }
                },
                isFieldAnnotated: function(field, annotationName) {
                    return isFieldAnnotated(field, annotationName);
                }
            };
        }
    };

    if (typeof target.ODS === 'undefined') {
        target.ODS = {};
    }
    target.ODS = angular.extend(target.ODS, ODS);
})(window);
;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsAggregation', ['ODSAPI', function(ODSAPI) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsAggregation
         * @scope
         * @restrict A
         * @param {string} [odsAggregation=aggregation] Variable name to use
         * @param {CatalogContext|DatasetContext} odsAggregationContext {@link ods-widgets.directive:odsCatalogContext Catalog Context} or {@link ods-widgets.directive:odsDatasetContext Dataset Context} to use
         * @param {string} [odsAggregationFunction=COUNT] Aggregation function to apply (AVG, COUNT, MIN, MAX, STDDEV, SUM)
         * @param {string} [odsAggregationExpression=none] Expression to apply the function on, typically the name of a field. Optional only when the function is "COUNT".
         * @description
         * This widget exposes the results of an aggregation function over a context. Can be used for example to expose the average temperature of a weather dataset.
         * The result is exposed into a new variable that you can use in other widgets or directly in your HTML.
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-dataset-context context="tree" tree-dataset="arbresremarquablesparis2011" tree-domain="parisdata.opendatasoft.com" tree-parameters="{'sort': '-objectid'}">
         *              <div class="row-fluid">
         *                  <div class="span4">
         *                      <ods-facets context="tree"></ods-facets>
         *                  </div>
         *                  <div class="span8" ods-aggregation="height" ods-aggregation-context="tree" ods-aggregation-expression="hauteur" ods-aggregation-function="AVG">
         *                      Average height is {{ height }} meters.
         *                  </div>
         *              </div>
         *          </ods-catalog-context>
         *      </file>
         *  </example>
         */

        return {
            restrict: 'A',
            scope: true,
            controller: ['$scope', '$attrs', function ($scope, $attrs) {
                var context = $scope.$eval($attrs.odsAggregationContext);
                var func = $attrs.odsAggregationFunction || 'COUNT';
                var expr = $attrs.odsAggregationExpression;
                var variableName = $attrs.odsAggregation || 'aggregation';
                context.wait().then(function() {
                    $scope.$watch(context.name+'.parameters', function(nv, ov) {
                        var options = angular.extend({}, nv, {
                            'y.serie1.expr': expr,
                            'y.serie1.func': func
                        });
                        ODSAPI.records.analyze(context, options).success(function(data) {
                            $scope[variableName] = data[0].serie1;
                        });
                    }, true);
                });
            }]
        };
    }]);
}());;(function() {
    'use strict';

    var checkCondition = function checkCondition(scope, condition_expr, value) {
        try {
            return !!(scope.$eval(condition_expr, {
                                y: value
                            }));
        } catch (e) {
            console.warn("Error while compiling condition with expr", condition_expr);
        }
        return false;
    };

    var mod = angular.module('ods-widgets');


    mod.directive('odsAnalysis', ['ODSAPI', function(ODSAPI) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsAnalysis
         * @scope
         * @restrict A
         * @param {string} [odsAnalysis=analysis] Variable name to use
         * @param {DatasetContext} odsAnalysisContext {@link ods-widgets.directive:odsCatalogContext Catalog Context} or {@link ods-widgets.directive:odsDatasetContext Dataset Context} to use
         * @param {number} [odsAnalysisMax=all] Maximum number of results to show
         * @param {string} odsAnalysisSort name of serie to sort on (or -serieName to invert the sort)
         * @description
         * This widget exposes the results of an analysis (as an object containing a results array and optionally an aggregations object) in a variable available in the scope.
         * It can be used with AngularJS's ngRepeat to simply build a table of analysis results.
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-dataset-context context="tree" tree-dataset="arbresremarquablesparis2011" tree-domain="parisdata.opendatasoft.com">
         *              <table class="table table-bordered table-condensed table-striped">
         *                  <thead>
         *                      <tr>
         *                          <th>Tree name</th>
         *                          <th>Height</th>
         *                          <th>Circonference</th>
         *                      </tr>
         *                  </thead>
         *                  <tbody>
         *                      <tr ng-repeat="result in analysis.results"
         *                              ods-analysis="analysis"
         *                              ods-analysis-context="tree"
         *                              ods-analysis-max="10"
         *                              ods-analysis-x="espece"
         *                              ods-analysis-sort="circonference"
         *                              ods-analysis-serie-hauteur="AVG(hauteur)"
         *                              ods-analysis-serie-hauteur-cumulative="false"
         *                              ods-analysis-serie-circonference="AVG(circonf)"
         *                      >
         *                          <td>{{ result.x }}</td>
         *                          <td>{{ result.hauteur|number:2 }}</td>
         *                          <td>{{ result.circonference|number:2 }}</td>
         *                      </tr>
         *                  </tbody>
         *              </table>
         *          </ods-catalog-context>
         *      </file>
         *  </example>
         */

        var parseCustomExpression = function(serie, parentserie_for_subseries) {
            var regex = /([A-Z_-]*?)\((.*?)\)/g;
            var params2regex = /([A-Z_-]*?)\(([a-zA-Z0-9\._]+),\s?([0-9\.]+)\)/g;
            var aggregates_holder = parentserie_for_subseries || serie;
            var match;

            serie.compiled_expr = "" + serie.expr;
            aggregates_holder.aggregates = [];

            var options = {};
            while (match = regex.exec(serie.expr)) {
                var extended_match = params2regex.exec(match[0]);
                if (extended_match && extended_match.length === 4) {
                    match = extended_match;
                }
                if (match && (match.length === 3 || match.length === 4)) {
                    if (match[2].indexOf('serie') === 0) {
                        var compiled = "operators." + match[1].toLowerCase() + ".apply(null, accumulation['" + match[2] + "']";
                        if (match.length === 4) {
                            compiled += ", " + match[3];
                        }
                        compiled += ")";
                        serie.compiled_expr = serie.compiled_expr.replace(match[0], compiled);
                        aggregates_holder.aggregates.push(match[2]);
                    } else { // we are really trying to get values from the index
                        options['func'] = match[1];
                        options['expr'] = match[2];
                        if (match[3]) {
                            options['subsets'] = match[3];
                        }
                        serie.compiled_expr += serie.compiled_expr.replace(match[0], 'y');
                    }
                }
            }
            return options;
        };

        return {
            restrict: 'A',
            priority: 1001, // ng-repeat need to be executed when the results is in the scope.
            controller: ['$scope', '$attrs', function($scope, $attrs) {
                $scope[$attrs.odsAnalysisContext].wait().then(function() {
                    $scope.$watch($attrs.odsAnalysisContext, function(nv) {
                        var variable = $attrs.odsAnalysis || 'results';
                        var options = angular.extend({}, nv.parameters, {'maxpoints': $attrs.odsAnalysisMax || 0});
                        var aggregations = {}, series = {};
                        var xs = [];

                        if ($attrs.odsAnalysisSort) {
                            options.sort = $attrs.odsAnalysisSort;
                        }

                        angular.forEach($attrs, function(value, attr) {
                            var serie_name, cumulative;
                            if (attr.startsWith("odsAnalysisSerie")) {
                                serie_name = attr.replace("odsAnalysisSerie", "");
                                cumulative = false;
                                if (serie_name.endsWith("Cumulative")){
                                    if (serie_name.replace("Cumulative", "").length > 0) {
                                        serie_name = serie_name.replace("Cumulative", "");
                                        cumulative = value;
                                    } else {
                                        // serie name is in fact cumulative...
                                    }
                                }
                                serie_name = serie_name.toLowerCase();
                                if (!series[serie_name]) {
                                    series[serie_name] = {};
                                }
                                if (cumulative) {
                                    series[serie_name].cumulative = cumulative;
                                } else {
                                    var serie = {'expr': value};
                                    angular.extend(series[serie_name], parseCustomExpression(serie));
                                }
                            } else if (attr.startsWith("odsAnalysisAggregation")) {
                                serie_name = attr.replace("odsAnalysisAggregation", "");
                                serie_name = serie_name.toLowerCase();
                                if (!aggregations[serie_name]) {
                                    aggregations[serie_name] = {};
                                }
                                aggregations[serie_name].expr = serie_name;
                                aggregations[serie_name].func = value;
                            } else if (attr.startsWith("odsAnalysisX")) {
                                xs.push(value);
                            }
                        });

                        if (xs.length > 0) {
                            options.x = xs;
                        }

                        angular.forEach(series, function(serie, name) {
                            options["y." + name + ".expr"] = serie.expr;
                            options["y." + name + ".func"] = serie.func;
                            options["y." + name + ".cumulative"] = serie.cumulative || "false";
                            if (serie.func === 'QUANTILES') {
                                options["y." + name + ".subsets"] = serie.subsets || "50";
                            }

                            if (aggregations[name]) {
                                options['agg.' + name + '.expr'] = aggregations[name].expr;
                                options['agg.' + name + '.func'] = aggregations[name].func;
                            }
                        });

                        ODSAPI.records.analyze(nv, options).success(function(data) {
                            $scope[variable] = {};
                            if (angular.isArray(data)) {
                                $scope[variable] = {
                                    'results': data
                                };
                            } else {
                                $scope[variable] = data;
                            }
                        });
                    }, true);
                });
            }]
        };
    }]);


    mod.directive('odsAnalysisSerie', [function() {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsAnalysisSerie
         * @scope
         * @restrict A
         * @param {string} odsAnalysisSerie Analysis results
         * @param {string} odsAnalysisSerieCondition The condition to that the value must validate to be part of the serie. 'y' will be replaced by the value
         * @param {string} odsAnalysisSerieName name of the serie to check for validation 
         * @param {string} odsAnalysisSerieSeparateOnX name of the x axis in the analysis response used to split series
         * @param {string} odsAnalysisSerieMode if mode is set to "reduce", keep only the longest serie of all splited series. Requires separate-on-x parameter.
         * @description
         * This widget exposes only keeps the longest serie in the results from an analysis.
         * Results can be used as if coming from an analysis widget (and use a subaggregation on it for example)
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-dataset-context context="tree" tree-dataset="arbresremarquablesparis2011" tree-domain="parisdata.opendatasoft.com">
         *              <div
         *                      ods-analysis="analysis"
         *                      ods-analysis-context="tree"
         *                      ods-analysis-max="10"
         *                      ods-analysis-x="family"
         *                      ods-analysis-x="espece"
         *                      ods-analysis-sort="circonference"
         *                      ods-analysis-serie-hauteur="AVG(hauteur)"
         *                      ods-analysis-serie-hauteur-cumulative="false"
         *                      ods-analysis-serie-circonference="AVG(circonf)"
         *              >
         *                 <div
         *                      ods-analysis-serie="analysis.results"
         *                      ods-analysis-serie-condition="y > 20"
         *                      ods-analysis-serie-name="hauteur"
         *                      ods-analysis-serie-separate-on-x="family">
         *                     Longest serie: {{ results.length }}
         *                 </div>
         *              </div>
         *          </ods-catalog-context>
         *      </file>
         *  </example>
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-dataset-context context="tree" tree-dataset="arbresremarquablesparis2011" tree-domain="parisdata.opendatasoft.com">
         *              <div
         *                      ods-analysis="analysis"
         *                      ods-analysis-context="tree"
         *                      ods-analysis-max="10"
         *                      ods-analysis-x="family"
         *                      ods-analysis-x="espece"
         *                      ods-analysis-sort="circonference"
         *                      ods-analysis-serie-hauteur="AVG(hauteur)"
         *                      ods-analysis-serie-hauteur-cumulative="false"
         *                      ods-analysis-serie-circonference="AVG(circonf)"
         *              >
         *                 <div
         *                      ods-analysis-serie="analysis.results"
         *                      ods-analysis-serie-condition="y > 20"
         *                      ods-analysis-serie-name="hauteur"
         *                      ods-analysis-serie-separate-on-x="family">
         *                      ods-analysis-serie-mode="reduce">
         *                     Longest serie: {{ results.length }}
         *                 </div>
         *              </div>
         *          </ods-catalog-context>
         *      </file>
         *  </example>
         */
        return {
            restrict: 'A',
            scope: true,
            controller: ['$scope', '$attrs', function($scope, $attrs) {
                $scope.condition = '';
                $scope.field = '';
                $scope.$watch($attrs.odsAnalysisSerieCondition, function(nv) {
                    if (!$attrs.odsAnalysisSerieCondition) {
                        return;
                    }
                    $scope.condition = $attrs.odsAnalysisSerieCondition;
                }, true);
                $scope.$watch($attrs.odsAnalysisSerieName, function(nv) {
                    if (!$attrs.odsAnalysisSerieName) {
                        return;
                    }
                    $scope.name = $attrs.odsAnalysisSerieName;
                }, true);
                $scope.$watch($attrs.odsAnalysisSerieSeparateOnX, function(nv) {
                    if (!$attrs.odsAnalysisSerieSeparateOnX) {
                        return;
                    }
                    $scope.separateOnX = $attrs.odsAnalysisSerieSeparateOnX;
                }, true);
                $scope.$watch($attrs.odsAnalysisSerieMode, function(nv) {
                    if (!$attrs.odsAnalysisSerieMode) {
                        return;
                    }
                    $scope.mode = $attrs.odsAnalysisSerieMode;
                }, true);
            }],
            link: function(scope, element, attrs) {
                scope.$watch(attrs.odsAnalysisSerie, function(nv, ov) {
                    var analysis = nv,
                        i,
                        result,
                        currentValue,
                        longest_results = {},
                        currentXAxis;

                    if (scope.separateOnX) {
                        longest_results = {};
                    }
                    scope.results = {};

                    if (analysis) {
                        result = {};

                        for (i = 0; i < analysis.length; i++) {
                            currentValue = analysis[i][scope.name];
                            if ( scope.separateOnX ) {
                                currentXAxis = analysis[i]['x'][scope.separateOnX];
                            } else {
                                currentXAxis = "global";
                            }
                            if ( checkCondition(scope, scope.condition, currentValue) ) {
                                if ( !longest_results[currentXAxis] ) {
                                     longest_results[currentXAxis] = [];
                                }
                                longest_results[currentXAxis].push(analysis[i]);
                            } else {
                                if ( longest_results[currentXAxis] ) {
                                    if ( !result[currentXAxis] || result[currentXAxis].length < longest_results[currentXAxis].length ) {
                                        result[currentXAxis] = longest_results[currentXAxis];
                                    }
                                    longest_results[currentXAxis] = false;
                                }
                            }
                        }
                        angular.forEach(longest_results, function(longest_result, x) {
                            if ( !result[x] || result[x].length < longest_result.length ) {
                                result[x] = longest_result;
                            }
                        });

                        if ( scope.mode == "reduce" && scope.separateOnX ) {
                            var keys = Object.keys(result);
                            var biggest = [];
                            for (i = 0; i < keys.length; i++) {
                                if (result[keys[i]].length > biggest.length) {
                                    biggest = result[keys[i]];
                                }
                            }
                            angular.copy({'global': biggest}, scope.results);
                        } else {
                            angular.copy(result, scope.results);
                        }
                    }
                });
            }
        };
    }]);

    mod.directive('odsSubaggregation', ['ModuleLazyLoader', function(ModuleLazyLoader) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsSubaggregation
         * @scope
         * @restrict A
         * @param {string} odsSubaggregation Analysis results
         * @param {number} odsSubaggregationSerie* Aggregation expression
         * @description
         * This widget computes aggregations on an analysis result. It 
         * It can be used with AngularJS's ngRepeat to simply build a table of analysis results.
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-dataset-context context="tree" tree-dataset="arbresremarquablesparis2011" tree-domain="parisdata.opendatasoft.com">
         *                      <div
         *                              ods-analysis="analysis"
         *                              ods-analysis-context="tree"
         *                              ods-analysis-max="10"
         *                              ods-analysis-x="family"
         *                              ods-analysis-x="espece"
         *                              ods-analysis-sort="circonference"
         *                              ods-analysis-serie-hauteur="AVG(hauteur)"
         *                              ods-analysis-serie-hauteur-cumulative="false"
         *                              ods-analysis-serie-circonference="AVG(circonf)"
         *                      >
         *                          <div
         *                                  ods-subaggregation="analysis.results"
         *                                  ods-subaggregation-serie-maxhauteur="MAX(hauteur)"
         *                                  ods-subaggregation-serie-avgcirc="AVG(circonference)"
         *                          >
         *                              max height: {{ results[0].maxhauteur|number:2 }}<br>
         *                              average circonference: {{ results[0].avgcirc }}
         *                          </div>
         *                      </div>
         *          </ods-catalog-context>
         *      </file>
         *  </example>
         */

        var parseCustomExpression = function parseCustomExpression(serie, parentserie_for_subseries) {
            var regex = /([A-Z_-]*?)\((.*?)\)/g;
            var params2regex = /([A-Z_-]*?)\(([a-zA-Z0-9\._]+),\s?(.+)\)/g;
            var aggregates_holder = parentserie_for_subseries || serie;
            var match;

            serie.compiled_expr = "" + serie.expr;
            aggregates_holder.aggregates = [];

            var options = {};
            while (match = regex.exec(serie.expr)) {
                var extended_match = params2regex.exec(match[0]);
                if (extended_match && extended_match.length === 4) {
                    match = extended_match;
                }
                if (match && (match.length === 3 || match.length === 4)) {
                    options['func'] = match[1];
                    options['expr'] = match[2];
                    if (match[3]) {
                        options['param'] = match[3];
                    }
                    var compiled = "operators." + match[1].toLowerCase() + "(accumulation['" + match[2] + "']";
                    if (match.length === 4) {
                        compiled += ", " + match[3];
                    }
                    compiled += ")";
                    options['compiled_expr'] = serie.compiled_expr.replace(match[0], compiled);
                    options['needed_aggregates'] = match[2];
                }
            }
            return options;
        };

        var compileAggrValue = function compileAggrValue(scope, compiled_expr, accumulations, aggregates) {
            var valueY;
            try {
                valueY = scope.$eval(compiled_expr, {
                        operators: ss,
                        accumulation: function(accumulations, needed_aggregates) {
                            var res = {};
                            angular.forEach(needed_aggregates, function(k) {
                                res[k] = accumulations[k]
                            });
                            return res;
                        }(accumulations, aggregates),
                        console: console
                    }
                );
            } catch (e) {
                console.warn("Error while compiling aggregation value with expr", compiled_expr);
            }
            return valueY;
        }

        return {
            restrict: 'A',
            scope: true,
            controller: ['$scope', '$attrs', function($scope, $attrs) {
                $scope.aggregations = {};
                var cancel = $scope.$watch($attrs.odsSubaggregation, function(nv) {
                    if (!nv) {
                        return;
                    }
                    var aggregations = {};

                    angular.forEach($attrs, function(value, attr) {
                        var serie_name, cumulative;
                        if (attr.startsWith("odsSubaggregationSerie")) {
                            serie_name = attr.replace("odsSubaggregationSerie", "");
                            serie_name = serie_name.toLowerCase();
                            if (!aggregations[serie_name]) {
                                aggregations[serie_name] = {};
                            }
                            var aggregation = {'expr': value};
                            angular.extend(aggregations[serie_name], parseCustomExpression(aggregation));
                        }
                    });

                    angular.copy(aggregations, $scope.aggregations);
                    cancel();
                }, true);
            }],
            link: function(scope, element, attrs) {
                ModuleLazyLoader('simple-statistics').then(function() {
                    scope.$watch(attrs.odsSubaggregation, function(nv, ov) {
                        var values = {},
                            analysis = nv,
                            i,
                            result,
                            longest_results = {};

                        scope.results = [];

                        if (analysis) {
                            result = {};

                            angular.forEach(scope.aggregations, function(aggregation, name) {
                                values[aggregation.needed_aggregates] = [];
                            });

                            for (i = 0; i < analysis.length; i++) {
                                angular.forEach(values, function(useless, name) {
                                    if (typeof analysis[i][name] !== "undefined") {
                                        values[name].push(analysis[i][name]);
                                    }
                                });
                            }

                            angular.forEach(scope.aggregations, function(aggregation, name) {
                                result[name] = compileAggrValue(scope, aggregation.compiled_expr, values, [aggregation.needed_aggregates]);
                            });

                            scope.results.push(result);
                        }
                    }, true);
                });
            }
        };
    }]);

}());
;/**
 * Created by manu on 20/10/15.
 */
(function() {
    'use strict';

    var mod = angular.module('ods-widgets');
    mod.directive("odsAnalyze", function (URLSynchronizer, $location, DebugLogger) {
        return {
            restrict: 'E',
            template: ''
            + '<div class="records-analyze">'
            + '    <div ng-if="fakeMultiChartContext.datasets" no-controls="noControls" advanced-chart-controls chart-context="chartContext" context="fakeMultiChartContext" urlsynchronize></div>'
            + '    <div ng-if="fakeMultiChartContext.datasets" ods-highcharts-chart colors="colors" context="fakeMultiChartContext" parameters="chartContext.dataChart"></div>'
            + '</div>',
            scope: {
                context: '=',
                autoResize: '@',
                noControls: '=?'
            },
            replace: true,
            controller: ["$scope", function ($scope) {
                $scope.noControls = !!$scope.noControls;
                $scope.fakeMultiChartContext = {datasets: false};
                $scope.chartContext = {};
                $scope.context.wait().then(function () {
                    $scope.fakeMultiChartContext.datasets = {};
                    $scope.fakeMultiChartContext.datasets[$scope.context.dataset.datasetid] = $scope.context;
                });
            }]
        };
    });
}());;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    var autoResizeDefinition = ['$timeout', '$window', function($timeout, $window) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsAutoResize
         * @restrict A
         *
         * @description
         * Enables the auto resize functionality on widget that supports it. By default, it forces the affected element to fill the height
         * to the bottom of the window.
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <div ods-auto-resize>I fill the height</div>
         *      </file>
         *  </example>
         */

        return {
            restrict: 'A',
            require: ["?odsAutoResize", "?autoResize"],
            controller: function($scope, $element) {
            },
            link: function(scope, element, attrs, ctrls) {
                var timeout;
                var ctrl = ctrls[0] || ctrls[1];
                var autoresize = attrs.odsAutoResize || attrs.autoResize;

                if (autoresize !== 'false') {
                    var resize = function () {
                        var height = Math.max(200, angular.element($window).height() - element.offset().top);
                        element.height(height);
                    };
                    resize();

                    $(window).on('resize', function () {
                        $timeout.cancel(timeout);
                        timeout = $timeout(function () {
                            resize();
                            if (ctrl.onResize) {
                                ctrl.onResize();
                            }
                        }, 50);
                    });
                }
            }
        };
    }];

    mod.directive('odsAutoResize', autoResizeDefinition);
    mod.directive('autoResize', autoResizeDefinition);

}());

;(function() {
	'use strict';

	var mod = angular.module('ods-widgets');

	mod.directive('odsBreezometer', function() {
		/**
		 * @ngdoc directive
         * @name ods-widgets.directive:odsBreezometer
         * @restrict E
         * @scope
         * @param {string} key The Breezometer Widget Key. See http://breezometer.com
         * @param {string} location The city name.
         * @description
         * Integrates a Breezometer "widget" using the widget key provided by Breezometer
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-breezometer key="045042544641" location="paris"></ods-breezometer>
         *      </file>
         *  </example>
		 */
		return {
			restrict: 'E',
			replace: true,
			template: '<div class="ods-widgets"><div class="breezometer_widget"></div></div>',
			scope: {
				'key': '@',
				'location': '@'
			},
			link : function(scope, element, attrs) {
				function loadGMaps(next) {
					LazyLoad.js('https://maps.googleapis.com/maps/api/js?v=3.exp&libraries=places&weather', next);
				}
				function loadBreezometer(next) {
					LazyLoad.css('http://static.breezometer.com/widget/css/breezometer.plugin.min.css');
					LazyLoad.js('http://static.breezometer.com/widget/breezometer.plugin.min.js', next);
				}
				function initWidget() {
					$(element).find('.breezometer_widget').breezometer({
						lang: "en",
						key: attrs.key,
						vertical: false,
						location:attrs.location
					});
				}

				function checkBreezometer() {
					if (!$.breezometer) {
						loadBreezometer(initWidget);
					} else {
						initWidget();
					}
				}

				// Start loading the scripts
				if (!window.google || !window.google.maps) {
					loadGMaps(checkBreezometer);
				} else {
					checkBreezometer();
				}

			}
		}
	});
}());;(function () {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsCalendar', ['ODSAPI', 'ModuleLazyLoader', 'ODSWidgetsConfig', '$compile', 'URLSynchronizer',
        function (ODSAPI, ModuleLazyLoader, ODSWidgetsConfig, $compile, URLSynchronizer) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsCalendar
         * @restrict E
         * @scope
         * @param {DatasetContext} context {@link ods-widgets.directive:odsDatasetContext Dataset Context} to use
         * @param {string} startField The name of the datetime field to use as event start datetime.
         * @param {string} endField The name of the datetime field to use as event end datetime.
         * @param {string} titleField The name of the text field to use as event title.
         * @param {string} [eventColor=#C32D1C] The color (in hexadecimal form) used for all events.
         * @param {string} [tooltipFields=none] An ordered, comma separated list of fields to display in the event
         * tooltip.
         * @param {string} [calendarView=month] The default mode for the calendar. Can be 'month', 'agendaWeek' or
         * 'agendaDay'.
         * @param {string} [availableCalendarViews='month','agendaWeek','agendaDay'] A comma separated list of available
         * views for the calendar. Must be a sub list of ['month', 'agendaWeek', 'agendaDay'].
         * @param {boolean} [syncToUrl] If true, persists the `calendarView` in the page's URL.
         * @description
         * This widget can take any dataset containing at least two datetime fields and a text field and use it to
         * display a calendar. It can load at most 1000 events (records) at once.
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *              <ods-dataset-context context="events"
         *                                   events-domain="public.opendatasoft.com"
         *                                   events-dataset="evenements-publics-cibul">
         *                  <ods-calendar context="events"
         *                                start-field="date_start"
         *                                end-field="date_end"
         *                                title-field="title"
         *                                event-color="#333"
         *                                tooltip-fields="image, latlon, link, description"></ods-calendar>
         *              </ods-dataset-context>
         *      </file>
         *  </example>
         */
        return {
            restrict: 'E',
            scope: {
                context: '=',
                startField: '@?',
                endField: '@?',
                titleField: '@?',
                tooltipFields: '@?',
                eventColor: '@?',
                calendarView: '@?',
                availableCalendarViews: '@?',
                syncToUrl: '@'
            },
            require: '?refineOnClick',
            replace: true,
            template: ''+
            '<div class="odswidget-calendar">' +
            '    <div class="odswidget-calendar__fullcalendar"></div>'+
            '    <div class="odswidget-calendar__tooltip"></div>'+
            '    <div class="odswidget-calendar__loading-backdrop">' +
            '        <ods-spinner class="odswidget-calendar__loading-wheel"></ods-spinner>'+
            '    </div>'+
            '</div>',
            controller: function ($scope) {
                if ($scope.syncToUrl !== 'false') {
                    URLSynchronizer.addSynchronizedValue($scope, 'calendarView', 'calendarview');
                }
            },
            link: function (scope, element, attrs, refineOnClickCtrl) {
                var updateCalendarView = function () {
                    var currentView = scope.fullcalendar.fullCalendar('getView');
                    if (currentView.name != scope.calendarView) {
                        scope.calendarView = currentView.name;
                    }
                };
                var setupCalendar = function () {
                    // check directive params and fallback to metas if they are not set
                    var visualization_metas = {};
                    if (scope.context.dataset &&
                        scope.context.dataset.extra_metas &&
                        scope.context.dataset.extra_metas.visualization) {
                        visualization_metas = scope.context.dataset.extra_metas.visualization;
                    }
                    if (!angular.isDefined(scope.startField)) {
                        scope.startField = visualization_metas.calendar_event_start;
                    }

                    if (!angular.isDefined(scope.endField)) {
                        scope.endField = visualization_metas.calendar_event_end;
                    }

                    if (!angular.isDefined(scope.titleField)) {
                        scope.titleField = visualization_metas.calendar_event_title;
                    }

                    if (!angular.isDefined(scope.eventColor)) {
                        if (visualization_metas.calendar_event_color) {
                            scope.eventColor = visualization_metas.calendar_event_color
                        } else {
                            scope.eventColor = '#C32D1C';
                        }
                    }
                    if (!angular.isDefined(scope.availableCalendarViews)) {
                        if (visualization_metas.calendar_available_views) {
                            scope.availableCalendarViews = visualization_metas.calendar_available_views.split(/\s*,\s*/);
                        } else {
                            scope.availableCalendarViews = ['month', 'agendaWeek', 'agendaDay'];
                        }
                    } else {
                        scope.availableCalendarViews = scope.availableCalendarViews.split(/\s*,\s*/);
                    }
                    if (!angular.isDefined(scope.calendarView)) {
                        if (visualization_metas.calendar_default_view
                            && scope.availableCalendarViews.indexOf(visualization_metas.calendar_default_view) > -1) {
                            scope.calendarView = visualization_metas.calendar_default_view;
                        } else {
                            scope.calendarView = scope.availableCalendarViews[0];
                        }
                    } else if (scope.availableCalendarViews.indexOf(scope.calendarView) === -1) {
                        scope.calendarView = scope.availableCalendarViews[0];
                    }

                    if (angular.isDefined(scope.tooltipFields)) {
                        var tooltipFields = [];
                        angular.forEach(scope.tooltipFields.split(','), function (fieldName) {
                            tooltipFields.push(fieldName.trim());
                        });
                        scope.tooltipFields = tooltipFields;
                    } else if (visualization_metas.calendar_tooltip_fields) {
                        scope.tooltipFields = visualization_metas.calendar_tooltip_fields;
                    } else {
                        scope.tooltipFields = [];
                    }

                    // actual calendar setup
                    scope.tooltip = $(element).children('.odswidget-calendar__tooltip').first()
                        .qtip({
                            content: {
                                text: '',
                                button: true // close tooltip upon click
                            },
                            position: {
                                my: 'bottom center',
                                at: 'top center',
                                target: 'mouse',
                                viewport: $('.odswidget-calendar__fullcalendar'),
                                adjust: {
                                    mouse: false,
                                    scroll: false
                                }
                            },
                            show: false,
                            hide: false,
                            style: {
                                classes: 'odswidget-calendar__tooltip odswidget-calendar__tooltip--increase-precedence'
                            }
                        })
                        .qtip('api');

                    // hide tooltip for any click not directed at a calendar object
                    $(document).on('click', function (event) {
                        if (!$(event.target).parents('.fc-event').length &&
                            !$(event.target).parents('.odswidget-calendar__tooltip').length) {
                            hideTooltip();
                        }
                    });

                    scope.fullcalendar = $(element).children('.odswidget-calendar__fullcalendar').first();
                    scope.fullcalendar.fullCalendar({
                        lazyFetching: false,
                        header: {
                            left: 'prevYear,prev,next,nextYear, today',
                            center: 'title',
                            right: scope.availableCalendarViews.join(',')
                        },
                        lang: ODSWidgetsConfig.language,
                        loading: toggleLoadingWheel,
                        editable: true,
                        eventLimit: true, // allow "more" link when too many events
                        events: calendarDataSource,
                        eventDataTransform: buildEventFromRecord,
                        eventColor: scope.eventColor,
                        defaultView: scope.calendarView,
                        eventClick: function(data, event) {
                            if (refineOnClickCtrl) {
                                refineOnClickCtrl.refineOnRecord(data.record);
                            }
                            hideTooltip();
                            scope.tooltip
                                .set({
                                    'content.text': data.buildTooltipContent(),
                                    'position.target': [event.pageX, event.pageY]
                                })
                                .reposition(event)
                                .show(event);
                        }
                    });
                };

                var hideTooltip = function () {
                    $('.odswidget-calendar__tooltip').hide();
                };

                var updateCalendar = function () {
                    scope.fullcalendar.fullCalendar('refetchEvents');
                };

                var toggleLoadingWheel = function (isLoading) {
                    if (isLoading) {
                        $('.odswidget-calendar__loading-backdrop').show();
                    } else {
                        $('.odswidget-calendar__loading-backdrop').hide();
                    }
                };

                var calendarDataSource = function (start, end, timezone, callback) {
                    updateCalendarView();
                    ODSAPI.records.search(scope.context, getSearchOptions(start, end)).
                        success(function (data) {
                            callback(data.records);
                        });
                };

                var buildEventFromRecord = function (record) {
                    var end;
                    // fullcalendar does not handle full day event correctly (misses 1 day) so we need to add to day
                    // to the event to render it correctly
                    if (scope.context.dataset.getField(scope.endField).type === "date") {
                        end = moment(record.fields[scope.endField]).add(1, "day").format('YYYY-MM-DD');
                    } else {
                        end = record.fields[scope.endField];
                    }
                    return {
                        title: record.fields[scope.titleField],
                        start: record.fields[scope.startField],
                        end: end,
                        buildTooltipContent: eventTooltipContentBuilder(record),
                        editable: false,
                        record: record
                    }
                };

                var eventTooltipContentBuilder = function (record) {
                    var buildTooltipContent = function () {
                        var newScope = scope.$new(true);
                        newScope.record = record;
                        newScope.dataset = scope.context.dataset;
                        var content;
                        if (scope.context.dataset.extra_metas.visualization.calendar_tooltip_html_enabled && scope.context.dataset.extra_metas.visualization.calendar_tooltip_html) {
                            content = $compile('<div>' + scope.context.dataset.extra_metas.visualization.calendar_tooltip_html + '</div>')(newScope);
                        } else {
                            newScope.titleField = scope.titleField;
                            newScope.tooltipFields = scope.tooltipFields;
                            content = $compile('<ods-calendar-tooltip></ods-calendar-tooltip>')(newScope);
                        }
                        newScope.$apply();
                        return content;
                    };
                    return buildTooltipContent;
                };

                var getSearchOptions = function (start, end) {
                    // most basic options
                    var options = {
                        dataset: scope.context.dataset.datasetid,
                        rows: 1000
                    };
                    // apply common filters
                    options = $.extend(options, scope.context.parameters);
                    // restrict to current view
                    var boundsQuery = [
                        scope.startField + '<' + end.format('YYYY-MM-DD'),
                        scope.endField + '>=' + start.format('YYYY-MM-DD')
                    ].join(' AND ');
                    options = $.extend(options, {
                        'q.calendar_bounds': boundsQuery
                    });
                    return options;
                };

                ModuleLazyLoader('fullcalendar', 'qtip').then(function() {
                    scope.context.wait().then(function() {
                        setupCalendar();
                        // refresh data when context search parameters change
                        scope.$watch('context.parameters', function(nv, ov) {
                            if (nv !== ov) {
                                updateCalendar();
                            }
                        }, true);
                    });
                });

            }
        }
    }]);

    mod.directive('odsCalendarTooltip', function () {
        return {
            restrict: 'E',
            template: '' +
            '<h2 class="odswidget-calendar__tooltip-title">{{ record.fields[titleField] }}</h2>' +
            '<dl class="odswidget-calendar__tooltip-fields">' +
            '    <dt ng-repeat-start="field in dataset.fields|fieldsForVisualization:\'calendar\'|fieldsFilter:tooltipFields"' +
            '        ng-show="record.fields[field.name]|isDefined"' +
            '        class="odswidget-calendar__tooltip-field-name">' +
            '        {{ field.label }}' +
            '    </dt>' +
            '    <dd ng-repeat-end ng-switch="field.type" ng-show="record.fields[field.name]|isDefined">' +
            '        <debug data="record.fields[field.name]"></debug>' +
            '        <span ng-switch-when="geo_point_2d">' +
            '            <ods-geotooltip width="300" height="300" coords="record.fields[field.name]">'+
            '                {{ record.fields|formatFieldValue:field }}'+
            '            </ods-geotooltip>' +
            '        </span>' +
            '        <span ng-switch-when="geo_shape">' +
            '            <ods-geotooltip width="300" height="300" geojson="record.fields[field.name]">'+
            '                {{ record.fields|formatFieldValue:field }}'+
            '            </ods-geotooltip>' +
            '        </span>' +
            '        <span ng-switch-when="file">' +
            '            <div ng-if="!dataset.isFieldAnnotated(field, \'has_thumbnails\')"'+
            '                 ng-bind-html="record.fields|formatFieldValue:field"></div>' +
            '            <div ng-if="dataset.isFieldAnnotated(field, \'has_thumbnails\')"'+
            '                 ng-bind-html="record.fields[field.name]|displayImageValue:dataset.datasetid"'+
            '                 style="text-align: center;"></div>' +
            '        </span>' +
            '        <span ng-switch-default ' +
            '              title="{{record.fields|formatFieldValue:field}}" ' +
            '              ng-bind-html="record.fields|formatFieldValue:field|imagify|videoify|prettyText|nofollow">'+
            '        </span>' +
            '    </dd>' +
            '</dl>'
        }
    });
}());
;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsCatalogContext', ['ODSAPI', 'URLSynchronizer', '$interpolate', function(ODSAPI, URLSynchronizer, $interpolate) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsCatalogContext
         * @scope
         * @restrict AE
         *  @param {string} context A name (or list of names separated by commas) of contexts to declare. The contexts are further
         *  configured using specific attributes, as described below.
         *  @description
         *  A "catalog context" represents the entire catalog (list) of datasets from a given domain, and a set of parameters used to query this catalog. A context can be used
         *  by one or more directives, so that they can share information (generally the query parameters). For example, a directive
         *  that displays a time filter can be "plugged" on the same context as a results list, to filter the displayed results.
         *
         *  The `odsCatalogContext` creates a new child scope, and exposes its contexts into it. In other words, the contexts
         *  will be available to any directive that is inside the `odsCatalogContext` element. You can nest `odsCatalogContext` directives inside each others.
         *
         *  A single `odsCatalogContext` can declare one or more context at once. To initialize contexts, you declare
         *  them in the **context** attribute. Then, you can configure them further using attributes prefixed by the context
         *  name (**CONTEXTNAME-SETTING**, e.g. mycontext-domain). The available settings are:
         *
         *  * **`domain`** - {@type string} - (optional) Indicate the "domain" (used to construct an URL to an API root) where to find the dataset.
         * Domain value can be:
         *
         *      * a simple alphanum string (e.g. *mydomain*): it will assume it is an OpenDataSoft domain (so in this example *mydomain.opendatasoft.com*)
         *
         *      * a hostname (e.g. *data.mydomain.com*)
         *
         *      * an absolute path (e.g. _/monitoring_), it will be absolute to the hostname of the current page
         *
         *      * a hostname and a path (e.g. *data.mydomain.com/monitoring*)
         *
         *      * nothing: in that case, {@link ods-widgets.ODSWidgetsConfigProvider ODSWidgetsConfig.defaultDomain} is used
         *
         *  * **`apikey`** {@type string} (optional) API Key to use in every API call for this context
         *
         *  * **`parameters`** {@type Object} (optional) An object holding parameters to apply to the context when it is created.
         *
         *  * **`urlsync`** {@type Boolean} Enable synchronization of the parameters to the page's parameters (query string). If you share the page with parameters in the URL, the context will
         *  use them; and if the context parameters change, the URL parameters will change as well. If enabled, **`parameters`** won't have any effect. Note that there can only be a single context
         *  with URL synchronization enabled, else the behavior will be unpredictable.
         *
         *  Once created, the context is exposed and accessible as a variable named after it. The context contains properties that you can access directly:
         *
         *  * domainUrl: a full URL the the domain of the context, that can be used to create links
         *
         *  * parameters: the parameters object of the context
         *
         *  **Note:** Due to naming conventions in various places (HTML attributes, AngularJS...), context names
         *  have to be lowercase, can only contain alphanumerical characters, and can't begin with a number, "data", or "x".
         *
         *  @example
         *  <pre>
         *  <ods-catalog-context context="public">
         *      <ods-result-enumerator context="public">
         *          <p>{{item.datasetid}}</p>
         *      </ods-result-enumerator>
         *  </ods-catalog-context>
         *  </pre>
         */

        // TODO: Ability to preset parameters, either by a JS object, or by individual parameters (e.g. context-refine=)
        return {
            restrict: 'AE',
            scope: true,
            replace: true,
            controller: ['$scope', '$attrs', function($scope, $attrs) {
                var contextNames = $attrs.context.split(',');
                for (var i=0; i<contextNames.length; i++) {
                    var contextName = contextNames[i].trim();

                    // Do we have a domain ID?
                    var domain = $attrs[contextName+'Domain'];
                    if (domain) {
                        domain = $interpolate(domain)($scope);
                    }

                    var parameters = $scope.$eval($attrs[contextName+'Parameters']) || {};
                    if ($attrs[contextName+'Source']) {
                        parameters.source = $interpolate($attrs[contextName+'Source'])($scope);
                    }

                    var apikey = $attrs[contextName+'Apikey'];
                    if (apikey) {
                       apikey = $interpolate(apikey)($scope);
                    }

                    $scope[contextName] = {
                        'name': contextName,
                        'type': 'catalog',
                        'domain': domain,
                        'domainUrl': ODSAPI.getDomainURL(domain),
                        'apikey': apikey,
                        'parameters': parameters,
                        'toggleRefine': function(facetName, path, replace) {
                            ODS.Context.toggleRefine(this, facetName, path, replace);
                        },
                        'getActiveFilters':  function () {
                            if (this.parameters) {
                                var filters = Object.keys(this.parameters);
                                var that = this;
                                return filters.filter(function (filter) {
                                    return (filter == 'q' && that.parameters.q && that.parameters.q.length > 0)
                                        || filter == 'geofilter.polygon'
                                        || filter == 'geofilter.distance'
                                        || filter.indexOf('refine.') === 0
                                        || (filter == 'q.geographic_area' && that.parameters['q.geographic_area'] && that.parameters['q.geographic_area'].length > 0)
                                });
                            } else {
                                return [];
                            }
                        }
                    };

                    if ($scope.$eval($attrs[contextName+'Urlsync'])) {
                        if (!angular.equals(parameters, {})) {
                            console.log('WARNING : Context ' + contextName + ' : There are specific parameters defined, but URL sync is enabled, so the parameters will be ignored.');
                        }
                        URLSynchronizer.addSynchronizedObject($scope, contextName + '.parameters');
                    }
                }
            }]
        };
    }]);
}());;(function () {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsClearAllFilters', function () {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsClearAllFilters
         * @scope
         * @restrict E
         * @param {CatalogContext|DatasetContext|CatalogContext[]|DatasetContext[]} context 
         * {@link ods-widgets.directive:odsCatalogContext Catalog Context} or 
         * {@link ods-widgets.directive:odsDatasetContext Dataset Context} to display the filters of, or list of 
         * contexts.
         * 
         * @description
         * This widget displays a button which will clear all active filters in the given context.
         */
        return {
            restrict: 'E',
            replace: true,
            scope: {
                context: '='
            },
            template: '' +
            '<a class="odswidget-clear-all-filters" href="" ng-click="clearAll()">' +
            '    <i class="fa fa-ban"></i> ' +
            '    <span translate>Clear all</span>' +
            '</a>',
            controller: ['$scope', function ($scope) {
                $scope.clearAll = function () {
                    var contexts = $scope.context;
                    if (!angular.isArray($scope.context)) {
                        contexts = [$scope.context];
                    }
                    angular.forEach(contexts, function (context) {
                        angular.forEach(context.getActiveFilters(), function (k) {
                            delete context.parameters[k];
                        });
                    });
                    return false;
                };

            }]
        }
    });
})();
;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    var renderCard = function(transcludeService, scope, elem) {
        var datasetItem = elem.find('.dataset-item').first();
        var cardContainer = elem.find('.card-container');
        var cardHeight = $(cardContainer).outerHeight();
        if (scope.position == "bottom") {
            $(datasetItem).css('top', 0);
            $(datasetItem).css('bottom', cardHeight);
        } else { // top
            $(datasetItem).css('top', cardHeight);
            $(datasetItem).css('bottom', 0);
        }
        transcludeService(function(clone) {
            $(datasetItem).html(clone);
        });
    };

    mod.directive('odsDatasetCard', function() {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsDatasetCard
         * @restrict E
         * @scope
         * @param {DatasetContext} context {@link ods-widgets.directive:odsDatasetContext Dataset Context} to use
         * @description
         * If you wrap this directive around an element or a set of element, it will display an expandable card above it to show the title and description of the dataset,
         * along with a link to the portal that shows the dataset, and the license attached to the data.
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *              <ods-dataset-context context="stations" stations-domain="public.opendatasoft.com" stations-dataset="jcdecaux_bike_data">
         *                  <ods-dataset-card context="stations" style="height: 600px">
         *                      <ods-map context="stations"></ods-map>
         *                  </ods-dataset-card>
         *              </ods-dataset-context>
         *      </file>
         *  </example>
         */
        return {
            restrict: 'E',
            scope: {
                context: '='
            },
            template: '<div class="odswidget odswidget-dataset-card">' +
                         '<div class="card-container" ng-class="{bottom: position == \'bottom\', expanded: expanded, expandable: isExpandable()}">' +
                            '<h2 class="dataset-title" ng-click="expanded = !expanded" ng-show="!expanded || (expanded && !context.dataset.metas.description)">{{context.dataset.metas.title}}</h2>' +
                            '<div ng-click="expanded = !expanded" class="expand-control"><span translate>Details</span> <i class="fa fa-chevron-down" ng-show="!expanded"></i><i class="fa fa-chevron-up" ng-hide="!expanded"></i></div>' +
                            '<div class="dataset-expanded" ng-click="expanded = !expanded"">'+
                                '<h2 class="dataset-title" ng-show="expanded">{{context.dataset.metas.title}}</h2>' +
                                '<p class="dataset-description" ng-if="expanded" ng-bind-html="safeHtml(context.dataset.metas.description)"></p>' +
                            '</div>' +
                         '<div class="dataset-infos"><span class="dataset-infos-text"><a ng-href="{{datasetUrl}}" target="_blank" ng-bind-html="websiteName"></a><span ng-show="context.dataset.metas.license"> - <span translate>License</span> {{context.dataset.metas.license}}</span></span></div>' +
                     '</div>' +
                    '<div class="dataset-item"></div>' +
                '</div>',
            replace: true,
            transclude: true,
            link: function(scope, elem, attrs) {
                scope.position = attrs.position || "top";
                // moves embedded item down so the card doesn't overlap when collapsed
            },
            controller: ['$scope', '$element', 'ODSWidgetsConfig', '$transclude', '$sce', '$timeout',
                function($scope, $element, ODSWidgetsConfig, $transclude, $sce, $timeout) {
                $scope.renderContent = renderCard;
                $scope.websiteName = ODSWidgetsConfig.websiteName;
                $scope.expanded = false;

                $scope.safeHtml = function(html) {
                    return $sce.trustAsHtml(html);
                };

                $scope.isExpandable = function() {
                    if (!$scope.context || !$scope.context.dataset || !$scope.context.dataset.datasetid) {
                        // No data yet
                        return false;
                    }

                    if (!$scope.context.dataset.metas.description) {
                        return false;
                    }

                    return true;
                };

                var unwatch = $scope.$watch('context', function(nv, ov) {
                    if (!nv || !nv.dataset) {
                        return;
                    }
                    // waiting for re-render
                    $timeout(function() {
                        $scope.renderContent($transclude, $scope, $element);
                    }, 0);
                    $scope.expanded = false;
                    $scope.datasetUrl = $scope.context.domainUrl + '/explore/dataset/' + $scope.context.dataset.datasetid + '/';
                    if (!$scope.websiteName) {
                        $scope.websiteName = $scope.context.domainUrl;
                    }
                    unwatch();
                }, true);
                $scope.renderContent($transclude, $scope, $element);
            }]
        };
    });

    mod.directive('odsMultidatasetsCard', ['ODSWidgetsConfig', function(ODSWidgetsConfig) {
        return {
            restrict: 'E',
            scope: {
                odsTitle: '=',
                datasets: '=',
                context: '='
            },
            template: '<div class="odswidget-multidatasets-card">' +
                      '  <div class="card-container multidatasets" ng-class="{bottom: (position == \'bottom\'), expanded: expanded, expandable: isExpandable()}">' +
                      '      <h2 ng-show="!expanded" ng-click="tryToggleExpand()">{{ odsTitle }}</h2>' +
                      '      <div ng-click="tryToggleExpand()" class="expand-control" ng-class="{expanded: expanded}"><span translate>Details</span> <i class="fa fa-chevron-down"></i></div>' +
                      '      <h3 class="datasets-counter" ng-click="tryToggleExpand()" ng-show="!expanded">' +
                      '          <span class="count-text" ng-hide="!datasetObjectKeys || datasetObjectKeys.length <= 1">' +
                      '               <span translate translate-n="datasetObjectKeys.length" translate-plural="{{$count}} datasets">{{$count}} dataset</span>' +
                      '          </span>' +
                      '      </h3>' +
                      '      <div class="datasets-expanded">' +
                      '          <h2 ng-show="expanded" ng-click="tryToggleExpand()">{{ odsTitle }}</h2>' +
                      '          <h3 class="datasets-counter" ng-click="tryToggleExpand()" ng-show="expanded">' +
                      '              <span class="count-text">' +
                      '                   <span translate translate-n="datasetObjectKeys.length" translate-plural="{{$count}} datasets">{{$count}} dataset</span>' +
                      '              </span>' +
                      '          </h3>' +
                      '          <ul class="dataset-list"' +
                      '              ng-show="(datasetObjectKeys && datasetObjectKeys.length === 1) || (isExpandable() && expanded)"' +
                      '              ng-class="{\'single-dataset\': datasetObjectKeys.length === 1}">' +
                      '              <li ng-repeat="(key, dataset) in datasets"> <a' +
                      '                  ng-href="{{context.domainUrl}}/explore/dataset/{{dataset.datasetid}}/"' +
                      '                  target="_blank">{{ dataset.metas.title }}</a>' +
                      '                  <span ng-show="dataset.metas.license">- <span translate>License</span> {{ dataset.metas.license }}</span></li>' +
                      '          </ul>' +
                      '      </div>' +
                      '      <div class="dataset-infos"><span class="dataset-infos-text"><a ng-href="/" target="_blank" ng-bind-html="websiteName"></a></span></div>' +
                      '  </div>' +
                      '  <!-- embedded content (chart, map etc.) -->' +
                      '  <div class="dataset-item" ng-transclude></div>' +
                    '</div>',
            replace: true,
            transclude: true,
            link: function(scope, elem, attrs) {
                scope.position = attrs.position || "top";
                // moves embedded item down so the card doesn't overlap when collapsed
            },
            controller: ['$scope', '$element', 'ODSWidgetsConfig', '$transclude', '$sce', '$timeout',
                function($scope, $element, ODSWidgetsConfig, $transclude, $sce, $timeout) {
                $scope.renderContent = renderCard;
                $scope.datasetObjectKeys = [];
                $scope.websiteName = ODSWidgetsConfig.websiteName;

                $scope.safeHtml = function(html) {
                    return $sce.trustAsHtml(html);
                };

                $scope.isExpandable = function() {
                    if (!$scope.datasetObjectKeys.length || ($scope.datasetObjectKeys.length === 1)) {
                        return false;
                    }
                    return true;
                };

                $scope.tryToggleExpand = function() {
                    if ($scope.isExpandable()) {
                        $scope.expanded = !$scope.expanded;
                    }
                };

                var unwatch = $scope.$watch('datasets', function(nv, ov) {
                    if (nv) {
                        var keys = Object.keys(nv);
                        if (keys.length === 0) {
                            return;
                        }
                        $scope.datasetObjectKeys = keys;

                        // waiting for re-render
                        $timeout(function() {
                            $scope.renderContent($transclude, $scope, $element);
                        }, 0);
                        $scope.expanded = false;
                        unwatch();
                    }
                }, true);
                $timeout(function() {
                    $scope.renderContent($transclude, $scope, $element);
                }, 0);
            }]
        };
    }]);
})();
;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsDatasetContext', ['ODSAPI', '$q', '$interpolate', 'URLSynchronizer', function(ODSAPI, $q, $interpolate, URLSynchronizer) {
        /**
         *
         *  @ngdoc directive
         *  @name ods-widgets.directive:odsDatasetContext
         *  @scope
         *  @restrict AE
         *  @param {string} context A name (or list of names separated by commas) of contexts to declare. The contexts are further
         *  configured using specific attributes, as described below.
         *  @description
         *  A "dataset context" represents a dataset, and a set of parameters used to query its data. A context can be used
         *  by one or more directives, so that they can share information (generally the query parameters). For example, a directive
         *  that displays a time filter can be "plugged" on the same context as a table view directive, so that the user
         *  can filter the data displayed in the table.
         *
         *  The `odsDatasetContext` creates a new child scope, and exposes its contexts into it. In other words, the contexts
         *  will be available to any directive that is inside the `odsDatasetContext` element. You can nest `odsDatasetContext` directives inside each others.
         *
         *  A single `odsDatasetContext` can declare one or more context at once. To initialize contexts, you declare
         *  them in the **context** attribute. Then, you can configure them further using attributes prefixed by the context
         *  name (**CONTEXTNAME-SETTING**, e.g. mycontext-domain). The available settings are:
         *
         *  * **`domain`** - {@type string} - (optional) Indicate the "domain" (used to construct an URL to an API root) where to find the dataset.
         * Domain value can be:
         *
         *      * a simple alphanum string (e.g. *mydomain*): it will assume it is an OpenDataSoft domain (so in this example *mydomain.opendatasoft.com*)
         *
         *      * a hostname (e.g. *data.mydomain.com*)
         *
         *      * an absolute path (e.g. _/monitoring_), it will be absolute to the hostname of the current page
         *
         *      * a hostname and a path (e.g. *data.mydomain.com/monitoring*)
         *
         *      * nothing: in that case, {@link ods-widgets.ODSWidgetsConfigProvider ODSWidgetsConfig.defaultDomain} is used
         *
         *  * **`dataset`** - {@type string} Identifier of the dataset
         *
         *  * **`apikey`** {@type string} (optional) API Key to use in every API call for this context
         *
         *  * **`sort`** {@type string} (optional) Sort expression to apply initially (*field* or *-field*)
         *
         *  * **`parameters`** {@type Object} (optional) An object holding parameters to apply to the context when it is created. Any parameter from the API can be used here (such as `q`, `refine.FIELD` ...)
         *
         *  * **`parametersFromContext`** {@type string} (optional) The name of a context to replicate the parameters from. Any change of the parameters
         *  in this context or the original context will be applied to both.
         *
         *  * **`urlsync`** {@type Boolean} Enable synchronization of the parameters to the page's parameters (query string). If you share the page with parameters in the URL, the context will
         *  use them; and if the context parameters change, the URL parameters will change as well. If enabled, **`parameters`** and **`parametersFromContext`** won't have any effect.
         *  Note that there can only be a single context with URL synchronization enabled, else the behavior will be unpredictable.
         *
         *  Once created, the context is exposed and accessible as a variable named after it. The context contains properties that you can access directly:
         *
         *  * domainUrl: a full URL the the domain of the context, that can be used to create links
         *
         *  * parameters: the parameters object of the context
         *
         *  * dataset: the dataset object for this context
         *
         *  * getDownloadURL(format[, dict options]): a method that returns an URL to download the data, including currently active filters (refinements, queries...). By default
         *  the URL will allow to download a CSV export, but you can pass another format such as "geojson" or "json".
         *  Two optional parameters : `{'use_labels_for_header': '<true/false>', 'fields': '<list of comma separated field name>'}`
         *
         *  * getQueryStringURL([dict options]): a method that build the URL suffix (`?key1=value1&key2=value2&...`) based on context parameters (active filters, refinement, sort, query...).
         *  The optional dictionary parameter allow to build the URL with additional key/value parameters.
         *
         *  **Note:** Due to naming conventions in various places (HTML attributes, AngularJS...), context names
         *  have to be lowercase, can only contain alphanumerical characters, and can't begin with a number, "data", or "x".
         *
         *  @example
         *  <pre>
         *  <ods-dataset-context context="trees" trees-dataset="trees-in-paris">
         *      <!-- Retrieved from a local API (no domain for the context)-->
         *      A dataset from {{trees.domainUrl}}.
         *  </ods-dataset-context>
         *  </pre>
         *
         *  <pre>
         *  <ods-dataset-context context="trees,clocks"
         *                       trees-dataset="arbresalignementparis2010"
         *                       trees-domain="http://opendata.paris.fr"
         *                       clocks-dataset="horloges_exterieures_et_interieures"
         *                       clocks-domain="public">
         *      <!-- Shows a list of the trees -->
         *      <ods-table context="trees"></ods-table>
         *      <!-- Shows a map of clocks -->
         *      <ods-map context="clocks"></ods-map>
         *  </ods-dataset-context>
         *  </pre>
         *
         *  <pre>
         *  <ods-dataset-context context="stations"
         *                       stations-dataset="jcdecaux_bike_data"
         *                       stations-domain="public.opendatasoft.com"
         *                       stations-parameters="{'q': 'place', 'refine.contract_name': 'Paris'}">
         *      <!-- All bike stations in Paris that have 'place' in their name or address -->
         *      <ods-map context="trees"></ods-map>
         *  </ods-dataset-context>
         *  </pre>
         */
        // TODO: Ability to preset parameters, either by a JS object, or by individual parameters (e.g. context-refine=)
        var exposeContext = function(domain, datasetID, scope, contextName, apikey, parameters, parametersFromContext, source, urlSync, schema) {
            var contextParams;
            if (!angular.equals(parameters, {})) {
                contextParams = parameters;
                if (urlSync) {
                    console.log('WARNING : Context ' + contextName + ' : There are specific parameters defined, but URL sync is enabled, so the parameters will be ignored.');
                }
            } else if (parametersFromContext) {
                var unwatch = scope.$watch(parametersFromContext, function(nv, ov) {
                    if (nv) {
                        if (source) {
                            nv.parameters.source = source;
                        }
                        scope[contextName].parameters = nv.parameters;
                        unwatch();
                    }
                });
                contextParams = null;
            } else {
                if (angular.equals(parameters, {})) {
                    // Typically someone passing a handmade object from an outerscope, to change it or watch it.
                    // Note that this is different from the first clause above, because it needs to pass AFTER
                    // parameters-from-context.
                    contextParams = parameters;
                } else {
                    contextParams = {};
                }
            }

            if (source && contextParams) {
                contextParams.source = source;
            }
            var deferred = $q.defer();
            scope[contextName] = {
                'wait': function() {
                    return deferred.promise;
                },
                'getDownloadURL': function(format, parameters) {
                    format = format || 'csv';
                    var url = this.domainUrl + '/explore/dataset/' + this.dataset.datasetid + '/download/?format=' + format;
                    url += this.getQueryStringURL(parameters);
                    return url;
                },
                'getQueryStringURL': function(parameters) {
                    parameters = parameters || {};
                    return '&' + ODS.URLUtils.getAPIQueryString(angular.extend({}, this.parameters, parameters));
                },
                'toggleRefine': function(facetName, path, replace) {
                    ODS.Context.toggleRefine(this, facetName, path, replace);
                },
                'getActiveFilters':  function () {
                    if (this.parameters) {
                        var filters = Object.keys(this.parameters);
                        var that = this;
                        return filters.filter(function (filter) {
                            return (filter == 'q' && that.parameters.q && that.parameters.q.length > 0)
                                || filter == 'geofilter.polygon'
                                || filter == 'geofilter.distance'
                                || filter.indexOf('refine.') === 0
                        });
                    } else {
                        return [];
                    }
                },
                'name': contextName,
                'type': 'dataset',
                'domain': domain,
                'domainUrl': ODSAPI.getDomainURL(domain),
                'apikey': apikey,
                'dataset': null,
                'parameters': contextParams

            };

            if (urlSync) {
                // Param
                /* FIXME V4
                    Currently, addSynchronizedObject supports a blacklist of parameters it doesn't want to watch.
                    This implies that the context has to know the list of things it doesn't want from the other components.

                    We probably instead want a whitelist, because each component knows what is relevant to it.
                 */
                URLSynchronizer.addSynchronizedObject(scope, contextName + '.parameters', ['basemap', 'location']);
            }

            if (schema) {
                scope[contextName].dataset = new ODS.Dataset(schema);
                deferred.resolve(scope[contextName].dataset);
            } else {
                ODSAPI.datasets.get(scope[contextName], datasetID, {
                    extrametas: true,
                    interopmetas: true,
                    source: (contextParams && contextParams.source) || source || ""
                }).
                    success(function (data) {
                        scope[contextName].dataset = new ODS.Dataset(data);
                        deferred.resolve(scope[contextName].dataset);
                    }).error(function (data) {
                        deferred.reject("Failed to fetch " + contextName + " context.");
                    });
            }
        };

        return {
            restrict: 'AE',
            scope: true,
            replace: true,
            controller: ['$scope', '$attrs', function($scope, $attrs) {
                var contextNames = $attrs.context.split(',');
                for (var i=0; i<contextNames.length; i++) {
                    // Note: we interpolate ourselves because we need the attributes value at the time of the controller's
                    // initialization, which is before the standard interpolation occurs.
                    var contextName = contextNames[i].trim();

                    // We need a dataset ID or a schema
                    if (!$attrs[contextName+'Dataset'] && !$attrs[contextName+'DatasetSchema']) {
                        console.log('ERROR : Context ' + contextName + ' : Missing dataset parameter');
                    }

                    var datasetID, domain, apikey, sort, source, schema;

                    if ($attrs[contextName+'Dataset']) {
                        datasetID = $interpolate($attrs[contextName + 'Dataset'])($scope);
                    }

                    // Do we have a domain ID?
                    if ($attrs[contextName+'Domain']) {
                        domain = $interpolate($attrs[contextName + 'Domain'])($scope);
                    }

                    if ($attrs[contextName + 'Apikey']) {
                        apikey = $interpolate($attrs[contextName + 'Apikey'])($scope);
                    }
                    if ($attrs[contextName+'Sort']) {
                        sort = $interpolate($attrs[contextName + 'Sort'])($scope);
                    }
                    if ($attrs[contextName+'Source']) {
                        source = $interpolate($attrs[contextName + 'Source'])($scope);
                    }

                    if ($attrs[contextName+'DatasetSchema']) {
                        schema = angular.fromJson($attrs[contextName + 'DatasetSchema'].replace(/\\{/g, '{').replace(/\\}/g, '}'));
                    }

                    var parameters = $scope.$eval($attrs[contextName+'Parameters']) || {};
                    var parametersFromContext = $attrs[contextName+'ParametersFromContext'];

                    if (sort) {
                        parameters.sort = sort;
                    }

                    var urlSync = $scope.$eval($attrs[contextName+'Urlsync']);

                    exposeContext(domain, datasetID, $scope, contextName, apikey, parameters, parametersFromContext, source, urlSync, schema);
                }
            }]
        };
    }]);

}());
;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsDatetime', function() {
        /**
         *  @ngdoc directive
         *  @name ods-widgets.directive:odsDatetime
         *  @restrict A
         *  @scope
         *  @description
         *  Get the ISO local datetime and store it into a variable (into the scope).
         *  Equivalent to moment().format() javascript call.
         *  The current scope gains a refreshDatetime method that will refresh the variable with the current datetime.
         *
         *  @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ANY ods-datetime="datetime">
         *              {{ datetime|moment:'YYYY-MM-DD HH:mm:ss' }}
         *          </ANY>
         *     </file>
         * </example>
         */
        return {
            restrict: 'A',
            controller: ['$scope', '$attrs', '$q', function($scope, $attrs, $q) {
                var variable = $attrs.odsDatetime || 'datetime';

                $scope.refreshDatetime = function () {
                    $scope[variable] = moment().format();
                };

                $scope.refreshDatetime();
            }]
        };
    });

}());
;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsDisqus', ['ODSWidgetsConfig', '$location', '$window', function(ODSWidgetsConfig, $location, $window) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsDisqus
         * @restrict E
         * @scope
         * @param {string} shortname Disqus shortname for your account. If not specified, {@link ods-widgets.ODSWidgetsConfigProvider ODSWidgetsConfig.disqusShortname} will be used.
         * @param {string} [identifier=none] By default, the discussion is tied to the URL of the page. If you want to be independant from the URL, or share the discussion between two or more pages, you can define an identifier in this parameter; it is recommended by Disqus to always do it from the start.
         * @description
         * This widget shows a Disqus panel where users can comment the page.
         *
         */
        return {
            restrict: 'E',
            replace: true,
            scope: {
                'shortname': '@',
                'identifier': '@'
            },
            template: '<div id="disqus_thread" class="odswidget"></div>',
            link: function (scope) {
                $window.disqus_shortname = scope.shortname || ODSWidgetsConfig.disqusShortname;
                if (scope.identifier) {
                    $window.disqus_identifier = scope.identifier;
                }
                $window.disqus_url = $location.absUrl();
                $window.disqus_config = function() {
                    this.language = ODSWidgetsConfig.language;
                };

                var dsq = document.createElement('script');

                dsq.type  = 'text/javascript';
                dsq.async = true;
                dsq.src   = '//' + $window.disqus_shortname + '.disqus.com/embed.js';

                (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(dsq);

            }
        };
    }]);

}());;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsDomainStatistics', ['ODSAPI', function(ODSAPI) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsDomainStatistics
         * @scope
         * @restrict AE
         * @param {DatasetContext} context {@link ods-widgets.directive:odsCatalogContext Catalog Context} to use
         * @description
         * This widget enumerates statistic values for a given catalog and injects them as variables in the context. The following AngularJS variables are available:
         *
         *  * CONTEXTNAME.stats.dataset : the number of datasets
         *  * CONTEXTNAME.stats.keyword : the number of keywords
         *  * CONTEXTNAME.stats.publisher : the number of publishers
         *  * CONTEXTNAME.stats.theme : the number of themes
         *
         * # First syntax: when declaring a catalog context, directly inject these values
         * <pre>
         * <ods-catalog-context context="catalog" catalog-domain="dataset" ods-domain-statistics>
         *     {{ catalog.stats.dataset }} datasets
         * </ods-catalog-context>
         * </pre>
         *
         * # Second syntax : inject them using a dedicated tag
         *  <pre>
         *  <ods-domain-statistics context="catalog">
         *      {{ catalog.stats.dataset }} datasets
         *  </ods-domain-statistics>
         *  </pre>
         *
         *  @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-catalog-context context="public" public-domain="public.opendatasoft.com" ods-domain-statistics>
         *              <p>Our portal has {{public.stats.dataset}} datasets, described by {{public.stats.theme}} themes
         *              and {{public.stats.keyword}} keywords.</p>
         *              <p>{{public.stats.publisher}} publishers have contributed.</p>
         *          </ods-catalog-context>
         *      </file>
         *  </example>
         */

        return {
            restrict: 'AE',
            scope: true,
            controller: ['$scope', '$attrs', function($scope, $attrs) {
                var setStatParameter = function(context, facetName, value) {
                    if (value.name === facetName) {
                        context.stats[facetName] = value.facets.length;
                        return true;
                    }
                    return false;
                };
                var init = $scope.$watch($attrs.context, function(nv) {
                    nv.stats = {
                        'dataset': 0,
                        'keyword': 0,
                        'publisher': 0,
                        'theme': 0
                    };
                    ODSAPI.datasets.search(nv, {'facet': ['keyword', 'publisher', 'theme'], 'rows': 0}).success(function (data) {
                        nv.stats.dataset = data.nhits;
                        if (data.facet_groups) {
                            for (var i = 0; i < data.facet_groups.length; i++) {
                                if (setStatParameter(nv, 'keyword', data.facet_groups[i])) continue;
                                if (setStatParameter(nv, 'publisher', data.facet_groups[i])) continue;
                                if (setStatParameter(nv, 'theme', data.facet_groups[i])) continue;
                            }
                        }
                    });
                    init();
                }, true);
            }]
        };
    }]);

}());
;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsFacetResults', ['ODSAPI', function(ODSAPI) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsFacetResults
         * @scope
         * @restrict A
         * @param {string} [odsFacetResults=results] Variable name to use
         * @param {CatalogContext|DatasetContext} odsFacetResultsContext {@link ods-widgets.directive:odsCatalogContext Catalog Context} or {@link ods-widgets.directive:odsDatasetContext Dataset Context} to use
         * @param {string} odsFacetResultsFacetName Name of the facet to enumerate
         * @param {string} [odsFacetResultsSort=count] How to sort the categories: either `count`, `-count` (sort by number of items in each category),
         * `num`, `-num` (sort by the name of category if it is a number), `alphanum`, `-alphanum` (sort by the name of the category).
         * @description
         * This widget fetches the results of enumerating the values ("categories") of a facet, and exposes it in a variable available in the scope. It can be used with AngularJS's ngRepeat to simply build a list
         * of results.
         *
         * The variable is an array of objects, each containing the following properties:
         *
         *  * `name` : the label of the category
         *  * `path` : the path to use to refine on this category
         *  * `state` : "displayed" or "refined"
         *  * `count` : the number of records in this category
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-catalog-context context="catalog" catalog-domain="public.opendatasoft.com">
         *              <label>Select a facet:</label>
         *              <select ng-model="userchoice">
         *                  <option ng-repeat="item in items" ods-facet-results="items" ods-facet-results-context="catalog" ods-facet-results-facet-name="publisher" value="{{item.name}}">{{item.name}}</option>
         *              </select>
         *          </ods-catalog-context>
         *      </file>
         *  </example>
         */

        return {
            restrict: 'A',
            scope: true,
            priority: 1001, // ng-repeat need to be executed when the results is in the scope.
            controller: ['$scope', '$attrs', function($scope, $attrs) {
                $scope.$watch($attrs.odsFacetResultsContext, function(nv) {
                    var query;
                    var facetName = $attrs.odsFacetResultsFacetName;

                    var sort = {};
                    if ($attrs.odsFacetResultsSort) {
                        sort['facetsort.'+facetName] = $attrs.odsFacetResultsSort;
                    }

                    var options = angular.extend({}, nv.parameters, {'rows': 0, 'facet': facetName}, sort);
                    var variable = $attrs.odsFacetResults || 'results';
                    if (nv.type === 'dataset' && nv.dataset) {
                        query = ODSAPI.records.search(nv, options);
                    } else if (nv.type === 'catalog') {
                        query = ODSAPI.datasets.search(nv, options);
                    } else {
                        return;
                    }
                    query.success(function(data){
                        if (data.facet_groups) {
                            var facetGroup = data.facet_groups.filter(function(g) {return g.name === facetName; });
                            if (facetGroup.length === 0) {
                                // Only a refine but no real value for the facet we want
                                $scope[variable] = [];

                            }
                             $scope[variable] = facetGroup[0].facets;

                        } else {
                            $scope[variable] = [];
                        }
                    });

                }, true);
            }]
        };
    }]);

}());
;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsFacets', ['$compile', 'translate', function($compile, translate) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsFacets
         * @scope
         * @restrict E
         * @param {DatasetContext} context {@link ods-widgets.directive:odsCatalogContext Catalog Context} or {@link ods-widgets.directive:odsDatasetContext Dataset Context} to use
         * @description
         * This widget displays filters (facets) for a dataset or a domain's catalog of datasets, allowing the users
         * to dynamically "refine" on one or more categories for the context, typically to restrict the data displayed
         * by another widget such as {@link ods-widgets.directive:odsTable odsTable}.
         *
         * Used alone without any configuration, the widget will display by default filters from all the "facet" fields
         * of a dataset if it is used with a {@link ods-widgets.directive:odsDatasetContext Dataset Context}, or based on
         * typical metadata from a dataset catalog if used with a {@link ods-widgets.directive:odsCatalogContext Catalog Context}.
         *
         * <pre>
         *     <ods-facets context="mycontext"></ods-facets>
         * </pre>
         *
         * To configure which facets are displayed, you can use the odsFacet directive within the odsFacets widget. You can also
         * use regular HTML within the odsFacets widget:
         * <pre>
         *     <ods-facets context="mycontext">
         *         <h3>First field</h3>
         *         <ods-facet name="myfield"></ods-facet>
         *
         *         <h3>Second field</h3>
         *         <ods-facet name="mysecondfield"></ods-facet>
         *     </ods-facets>
         * </pre>
         *
         *
         * The odsFacet directive supports the following parameters:
         *
         * - **`name`** {@type string} the name of the field to display the filter on
         *
         * - **`title`** {@type string} (optional) a title to display above the filters
         *
         * - **`sort`** {@type string} (optional, default is count) How to sort the categories: either `count`, `-count` (sort by number of items in each category),
         * `num`, `-num` (sort by the name of category if it is a number), `alphanum`, `-alphanum` (sort by the name of the category).
         * It is also possible to configure a specific order by setting a list of values: `['value1', 'value2']`.
         *
         * - **`visible-items`** {@type number} (optional, default 6) the number of categories to show; if there are more,
         * they are collapsed and can be expanded by clicking on a "more" link.
         *
         * - **`hide-if-single-category`** {@type boolean} (optional) if 'true', don't show the filter for that facet if there is
         * only one available category to refine on.
         *
         * - **`hide-category-if`** {@type string} (optional) an AngularJS expression to evaluate; if it evaluates to true, then
         * the category is displayed. You can use `category.name` (the value of the category), `category.path` (the complete path
         * to the category, including hierarchical levels) and `category.state` (refined, excluded, or displayed) in the expression.
         *
         * - **`disjunctive`** {@type boolean} (optional) if 'true', then the facet is in "disjunctive" mode, which means that after a first value selected,
         * you can select other possibles values that are all combined as "or". For example, if you click "red", then you can also click "green" and "blue",
         * and the resulting values can be green, red, or blue.
         *
         * - **`valueSearch`** {@type string} (optional) if 'true', then a search box is displayed above the categories, so that you can search within them easily.
         * If 'suggest', then the matching categories are not displayed until there is at least one character typed into the search box, effectively making it
         * into a suggest-like search box.
         * 
         * - **`refineAlso`** {@type DatasetContext|CatalogContext|DatasetContext[]|CatalogContext[]} (optional) An 
         * other context (or a list of contexts) that you want to filter based on your primary context's facets. This 
         * is especially usefull for contexts who share common data.
         *
         * - **`mysecondarycontextFacetName`** {@type string} (optional) The name of the facet in one of your secondary 
         * contexts (defined through the `refineAlso` parameter) that you want to map your original's facet on. You can 
         * see an example below of such a behaviour.
         *
         * <pre>
         *     <ods-facets context="mycontext">
         *         <ods-facet name="myfield" sort="-num" visible-items="10"></ods-facet>
         *         <ods-facet name="mysecondfield" hide-if-single-category="true" hide-category-if="category.name == 'hiddencategory'"></ods-facet>
         *     </ods-facets>
         * </pre>
         *
         * You can write HTML within the odsFacet tag to change the display template of each category. The available variables
         * within the template are `facetName` (the name of the field that the filter is based on), `category.name`
         * (the value of the category), `category.path` (the complete path to the category, including hierarchical levels)
         * and `category.state` (refined, excluded, or displayed).
         *
         * <pre>
         *     <ods-facets context="mycontext">
         *         <ods-facet name="myfield">
         *             {{category.name}} @ {{category.state}}
         *         </ods-facet>
         *     </ods-facets>
         * </pre>
         *
         * You can filter multiple contexts through this widget. To illustrate how this works, we'll consider 3 datasets
         * containing information relative to zipcodes: one containing the geo-shape of each zipcode (the zipcode being
         * stored in the column `zipcode`), one containing the population (again, the zipcode is stored in the `zipcode`
         * column) and a last one containing the name of the area (the zipcode being this time stored in the
         * `code_postal` column because this is a french dataset). In order to have a single zipcode facet that will
         * refine all 3 contexts simultaneously, we need to write the following.
         *
         * <pre>
         *     <ods-facets context="shapes">
         *         <ods-facet name="zipcode"
         *                    refine-also="[population,areanames]"
         *                    areanames-facet-name="code_postal"></ods-facet>
         *     </ods-facets>
         * </pre>
         *
         *  @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-dataset-context context="events"
         *                               events-domain="public.opendatasoft.com"
         *                               events-dataset="evenements-publics-cibul">
         *              <div class="row-fluid">
         *                  <div class="span4">
         *                      <ods-facets context="events">
         *                          <ods-facet name="updated_at" title="Date"></ods-facet>
         *                          <h3>
         *                              <i class="icon-tags"></i> Tags
         *                          </h3>
         *                          <ods-facet name="tags">
         *                              <div>
         *                                  <i class="icon-tag"></i> {{category.name}}
         *                              </div>
         *                          </ods-facet>
         *                      </ods-facets>
         *                  </div>
         *                  <div class="span8">
         *                      <ods-map context="events"></ods-map>
         *                  </div>
         *              </div>
         *          </ods-dataset-context>
         *      </file>
         *  </example>
         */
        var buildFacetTagsHTML = function(scope, element, facets) {
            var html = '';

            angular.forEach(facets, function(facet) {
                html += '<ods-facet ' +
                    'name="'+facet.name+'" ' +
                    // We need to escape double quotes when building an attribute value (issue platform#3789)
                    'title="'+(facet.title && facet.title.replace(/"/g, '&quot;') || facet.name)+'" ' +
                    'sort="'+(facet.sort || '')+'" ' +
                    'disjunctive="'+(facet.disjunctive || '')+'" ' +
                    'hide-if-single-category="'+(facet.hideIfSingleCategory ? 'true' : 'false')+'" ' +
                    'hide-category-if="'+(facet.hideCategoryIf || '')+'"' +
                    'value-formatter="'+(facet.valueFormatter || '')+'"' +
                    '>'+(facet.template || '')+'</ods-facet>';
            });
            var tags = angular.element(html);
            element.append(tags);
            $compile(tags)(scope);

        };
        return {
            restrict: 'E',
            replace: true,
            scope: {
                context: '=',
                facetsConfig: '='
            },
            compile: function(tElement) {
                var childrenCount = tElement.children().length;
                return function(scope, element) {
                    if (scope.facetsConfig) {
                        buildFacetTagsHTML(scope, element, scope.facetsConfig);
                        scope.init();
                    } else if (childrenCount === 0) {
                        // By default, we add all the available facets
                        var facets;

                        var unwatchContext = scope.$watch('context', function() {
                            if (scope.context) {
                                unwatchContext();
                                if (scope.context.type === 'catalog') {
                                    facets = [
                                        {name: 'modified', title: translate('Modified')},
                                        {name: 'publisher', title: translate('Publisher')},
                                        {name: 'keyword', title: translate('Keyword')},
                                        {name: 'theme', title: translate('Theme')}
                                    ];
                                    buildFacetTagsHTML(scope, element, facets);
                                    scope.init();
                                } else {
                                    scope.context.wait().then(function(){
                                        facets = angular.copy(scope.context.dataset.getFacets());
                                        angular.forEach(facets, function(f) {
                                            f.title = f.label;
                                            delete f.label;
                                            angular.forEach(f.annotations, function(annotation) {
                                                if (annotation.name === 'facetsort' && annotation.args.length > 0) {
                                                    f.sort = annotation.args[0];
                                                }
                                                if (annotation.name === 'disjunctive') {
                                                    f.disjunctive = true;
                                                }
                                            });
                                        });
                                        buildFacetTagsHTML(scope, element, facets);
                                        scope.init();
                                    });
                                }
                            }
                        }, true);
                    } else {
                    // We're starting the queries from here because at that time we are sure the children (odsFacets tags)
                    // are ready and have registered themselves.
                        scope.init();
                    }
                };
            },
            controller: ['$scope', 'ODSAPI', function($scope, ODSAPI) {
                var facetsMapping = {};

                $scope.facets = [];
                $scope.init = function() {
                    // Commented until we no longer need the call to refresh the nhits on the context
//                    if ($scope.facets.length === 0) {
//                        return;
//                    }
                    $scope.$watch(function() {
                        // FIXME: Generalize this and use a whitelist https://github.com/opendatasoft/ods-widgets/issues/13
                        var params = angular.copy($scope.context.parameters);
                        if (params.sort) {
                            delete params.sort;
                        }
                        if (params.start) {
                            delete params.start;
                        }
                        if (params.tab) {
                            delete params.tab;
                        }
                        if (params.dataChart) {
                            delete params.dataChart;
                        }
                        if ($scope.context.type === 'dataset') {
                            return [params, $scope.context.dataset];
                        } else {
                            return params;
                        }
                    }, function() {
                        if ($scope.context.type === 'catalog' || $scope.context.dataset) {
                            if (angular.isDefined($scope.context.parameters.start)) {
                                delete $scope.context.parameters.start;
                            }
                            $scope.refreshData();
                        }
                    }, true);
                };

                $scope.refreshData = function() {
                    var params = angular.extend({}, $scope.context.parameters, {
                        rows: 0,
                        facet: $scope.facets.map(function(facetInfo) { return facetInfo.name; })
                    });
                    $scope.facets.map(function(facetInfo) {
                        if (facetInfo.sort && facetInfo.sort.length && facetInfo.sort[0] !== '[') {
                            params['facetsort.'+facetInfo.name] = facetInfo.sort;
                        }
                    });

                    var req;
                    if ($scope.context.type === 'dataset') {
                        req = ODSAPI.records.search($scope.context, params);
                    } else {
                        req = ODSAPI.datasets.search($scope.context, params);
                    }

                    req.success(function(data) {
                        $scope.context.nhits = data.nhits;
                        var categories, facetItem, addedCategories;
                        angular.forEach($scope.facets, function(facet) {
                            facet.categories.splice(0, facet.categories.length);
                        });
                        if (data.facet_groups) {
                            angular.forEach(data.facet_groups, function(facetGroup) {
                                facetItem = $scope.facets.filter(function(f) { return f.name === facetGroup.name; });
                                if (facetItem.length > 0) {
                                    categories = facetItem[0].categories;
                                    // Add all the categories in the array
                                    addedCategories = [];
                                    if (facetItem[0].sort && facetItem[0].sort.length && facetItem[0].sort[0] === '[') {
                                        // This is an explicit order
                                        var explicitOrder = $scope.$eval(facetItem[0].sort);
                                        angular.forEach(explicitOrder, function(value) {
                                            var j, cat;
                                            for (j=0; j<facetGroup.facets.length; j++) {
                                                cat = facetGroup.facets[j];
                                                if (cat.path === value) {
                                                    addedCategories.push(cat);
                                                    facetGroup.facets.splice(j, 1);
                                                    break;
                                                }
                                            }
                                        });
                                        // Append the rest, as is
                                        Array.prototype.push.apply(addedCategories, facetGroup.facets);
                                    } else {
                                        addedCategories = facetGroup.facets;
                                    }
                                    Array.prototype.push.apply(categories, addedCategories);
                                }
                            });
                        }
                    });
                };

                this.registerFacet = function(name, sort, secondaryContexts, facetAttrs) {
                    var categories = [];
                    $scope.facets.push({'name': name, 'categories': categories, 'sort': sort});

                    // build mapping
                    facetsMapping[name] = [];
                    if (secondaryContexts) {
                        secondaryContexts = angular.isArray(secondaryContexts) ? secondaryContexts : [secondaryContexts];
                        angular.forEach(secondaryContexts, function (context) {
                            var contextFacetName = facetAttrs[context.name + 'FacetName'];
                            facetsMapping[name].push({
                                context: context,
                                facetName: contextFacetName ? contextFacetName : name
                            });
                            // check that mapping is correct
                            var checkMappingType = function (originalContext, secondaryContext) {
                                angular.forEach(originalContext.dataset.fields, function (originalField) {
                                    angular.forEach(secondaryContext.dataset.fields, function (secondaryField) {
                                        if (originalField.name === name
                                            && secondaryField.name === contextFacetName
                                            && originalField.type != secondaryField.type) {
                                            console.warn(
                                                'Error: mapping ' +
                                                originalContext.name + '\'s ' + '"' + originalField.name + '" (type ' + originalField.type + ') on ' +
                                                secondaryContext.name + '\'s ' + '"' + secondaryField.name + '" (type ' + secondaryField.type + ').'
                                            )
                                        }
                                    });
                                });
                            };
                            if (context.type === 'dataset') {
                                context.wait().then(function () {
                                    checkMappingType($scope.context, context);
                                });
                            } else {
                                checkMappingType($scope.context, context);
                            }
                        });
                    }
                    return categories;
                };

                this.setDisjunctive = function(name) {
                    $scope.context.parameters['disjunctive.'+name] = true;
                };

                this.toggleRefinement = function(facetName, path) {
                    $scope.context.toggleRefine(facetName, path);

                    angular.forEach(facetsMapping[facetName], function (mapping) {
                        mapping.context.toggleRefine(mapping.facetName, path);
                    });
                };
            }]
        };
    }]);

    mod.directive('odsFacet', function() {
        return {
            restrict: 'E',
            replace: true,
            scope: {
                name: '@',
                title: '@',
                visibleItems: '@',
                hideIfSingleCategory: '@',
                hideCategoryIf: '@',
                sort: '@',
                disjunctive: '@',
                valueSearch: '@',
                valueFormatter: '@',
                refineAlso: '=?'
            },
            template: function(tElement) {
                tElement.data('facet-template', tElement.html());
                return '' +
                    '<div ng-class="{\'odswidget\': true, \'odswidget-facet\': true, \'odswidget-facet--disjunctive\': isDisjunctive()}">' +
                    '    <h3 class="odswidget-facet__facet-title" ' +
                    '        ng-if="title && categories.length && visible()">' +
                    '        {{ title }}' +
                    '    </h3>' +
                    '    <ods-facet-category-list ng-if="visible()" ' +
                    '                             facet-name="{{ name }}" ' +
                    '                             value-search="{{ valueSearch }}" ' +
                    '                             hide-category-if="{{ hideCategoryIf }}" ' +
                    '                             categories="categories" ' +
                    '                             template="{{ customTemplate }}" ' +
                    '                             value-formatter="{{valueFormatter}}"></ods-facet-category-list>' +
                    '</div>';
            },
            require: '^odsFacets',
            link: function(scope, element, attrs, facetsCtrl) {
                if (angular.isUndefined(facetsCtrl)) {
                    console.log('ERROR : odsFacet must be used within an odsFacets tag.');
                }
                scope.categories = facetsCtrl.registerFacet(scope.name, scope.sort, scope.refineAlso, attrs);
                scope.facetsCtrl = facetsCtrl;
                if (scope.isDisjunctive()) {
                    facetsCtrl.setDisjunctive(scope.name);
                }
            },
            controller: ['$scope', '$element', function($scope, $element) {
                $scope.isDisjunctive = function() {
                    return angular.isString($scope.disjunctive) && $scope.disjunctive.toLowerCase() === 'true';
                };

                $scope.visibleItemsNumber = $scope.visibleItems || 6;

                this.toggleRefinement = function(path) {
                    $scope.facetsCtrl.toggleRefinement($scope.name, path);
                };
                this.getVisibleItemsNumber = function() {
                    return $scope.visibleItemsNumber;
                };
                $scope.visible = function() {
                    return !(angular.isString($scope.hideIfSingleCategory) && $scope.hideIfSingleCategory.toLowerCase() === 'true' && $scope.categories.length === 1 && $scope.categories[0].state !== 'refined');
                };
                // Is there a custom template into the directive's tag?
                $scope.customTemplate = $element.data('facet-template');
            }]
        };
    });

    mod.directive('odsFacetCategoryList', function() {
        return {
            restrict: 'E',
            replace: true,
            scope: {
                categories: '=',
                template: '@',
                facetName: '@',
                hideCategoryIf: '@',
                valueSearch: '@',
                valueFormatter: '@'
            },
            require: '^odsFacet',
            template: '' +
            '<ul class="odswidget-facet__category-list">' +
            '   <li class="odswidget-facet__value-search" ng-show="valueSearchEnabled">' +
            '       <input class="odswidget-facet__value-search-input" ng-model="valueFilter">' +
            '       <i ng-show="!!valueFilter" class="odswidget-facet__value-search-cancel fa fa-times" ng-click="valueFilter=\'\'"></i>' +
            '   </li>' +
            '   <li ng-repeat="category in categories|filter:searchValue(valueFilter)" class="odswidget-facet__category-container">' +
            '       <ods-facet-category ng-if="!categoryIsHidden(category)" facet-name="{{ facetName }}" category="category" template="{{template}}" value-formatter="{{valueFormatter}}" ng-show="visible($index)"></ods-facet-category>' +
            '   </li>' +
            '   <li ng-if="!suggestMode && visibleItems < (categories|filter:searchValue(valueFilter)).length" ' +
            '       class="odswidget-facet__expansion-control">' +
            '       <a ng-hide="expanded" href="#" ng-click="toggle($event)" class="odswidget-facet__expansion-control-link">' +
            '           <i class="fa fa-angle-right"></i>' +
            '           <span translate>More</span>' +
            '       </a>' +
            '       <a ng-show="expanded" href="#" ng-click="toggle($event)" class="odswidget-facet__expansion-control-link">' +
            '           <i class="fa fa-angle-right"></i>' +
            '           <span translate>Less</span>' +
            '       </a>' +
            '   </li>' +
            '</ul>',
            link: function(scope, element, attrs, facetCtrl) {
                scope.expanded = false;
                scope.visibleItems = facetCtrl.getVisibleItemsNumber();
                scope.visible = function(index) {
                    return scope.expanded || index < scope.visibleItems;
                };
                scope.toggle = function(event) {
                    event.preventDefault();
                    scope.expanded = !scope.expanded;
                };
                scope.categoryIsHidden = function(category) {
                    if (scope.suggestMode && scope.valueFilter === '') {
                        return true;
                    }
                    if (!scope.hideCategoryIf) {
                        return false;
                    }
                    var testScope = scope.$new(false);
                    testScope.category = category;
                    return testScope.$eval(scope.hideCategoryIf);
                };
            },
            controller: ['$scope', '$filter', function($scope, $filter) {
                $scope.valueFilter = '';
                $scope.valueSearchEnabled = false;
                $scope.suggestMode = false;
                if (angular.isString($scope.valueSearch)) {
                    if ($scope.valueSearch.toLowerCase() === 'true') {
                        $scope.valueSearchEnabled = true;
                    } else if ($scope.valueSearch.toLowerCase() === 'suggest') {
                        $scope.valueSearchEnabled = true;
                        $scope.suggestMode = true;
                    }
                }
                $scope.searchValue = function(search) {
                    if (!search) { return function() { return true; }; }
                    search = $filter('normalize')(search).toLowerCase();
                    return function(searchedCategory) {
                        var categoryName = $filter('normalize')(searchedCategory.name).toLowerCase();
                        return categoryName.indexOf(search) > -1;
                    };
                };
                this.emptySearch = function() {
                    $scope.valueFilter = '';
                };
            }]
        };
    });

    mod.directive('odsFacetCategory', ['$compile', function($compile) {
        return {
            restrict: 'E',
            replace: true,
            require: ['^odsFacet', '^?odsFacetCategoryList'],
            scope: {
                category: '=',
                facetName: '@',
                template: '@',
                valueFormatter: '@'
            },
            template: '' +
            '<div class="odswidget odswidget-facet-category">' +
            '   <a class="odswidget-facet__category" ' +
            '      href="#" ' +
            '      ng-click="toggleRefinement($event, category.path)" ' +
            '      ng-class="{\'odswidget-facet__category--refined\': category.state === \'refined\'}" ' +
            '      title="{{ category.name }}">' +
            '   </a>' +
            '</div>',
            link: function(scope, element, attrs, ctrls) {
                var facetCtrl = ctrls[0];
                var categoryList = ctrls[1];
                scope.toggleRefinement = function($event, path) {
                    $event.preventDefault();
                    facetCtrl.toggleRefinement(path);
                    categoryList.emptySearch();
                };
                var defaultTemplate = '' +
                    '<span class="odswidget-facet__category-count">{{ category.count|number }}</span> ' +
                    '<span class="odswidget-facet__category-name" ng-bind-html="formatCategory(category.name)"></span>';
                var template = scope.template || defaultTemplate;
                element.find('a').append($compile(template)(scope));

                if (scope.category.facets) {
                    var sublist = angular.element('<ods-facet-category-list categories="category.facets" template="{{template}}"></ods-facet-category-list>');
                    element.find('a').after(sublist);
                    $compile(sublist)(scope);
                }

            },
            controller: ['$scope', 'ValueDisplay', function($scope, ValueDisplay) {
                $scope.formatCategory = function(value) {
                    value = ODS.StringUtils.escapeHTML(value);
                    if ($scope.valueFormatter) {
                        return ValueDisplay.format(value, $scope.valueFormatter);
                    } else {
                        return value;
                    }
                };
            }]
        };
    }]);

}());
;(function () {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsFilterSummary', function () {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsFilterSummary
         * @scope
         * @restrict A
         * @param {CatalogContext|DatasetContext|CatalogContext[]|DatasetContext[]} context 
         * {@link ods-widgets.directive:odsCatalogContext Catalog Context} or 
         * {@link ods-widgets.directive:odsDatasetContext Dataset Context} to display the filters of. Can also be a 
         * list of contexts.
         * @param {string} [exclude=none] Optional: Name of parameters to not display, separated by commas. For example `q,rows,start`
         * @param {boolean} [clearAllButton=true] Optional: display a "clear all" button underneath the active filters' list.
         * @param {boolean} [hideContextsLabels=false] Optional: if you are working with multiple contexts, the 
         * context's label will be displayed within the filter. Set this option to true if you'd like not to display 
         * those.
         * @param {string} [mycontextLabel] Optional: if you are working with multiple contexts, the context's name 
         * (that is "mycontext") will be displayed within the filter. Use this option to specify a custom label.
         * @description
         * This widget displays a summary of all the active filters on a context: text search, refinements...
         *
         */
        return {
            restrict: 'E',
            replace: true,
            template: '' +
            '<ul class="odswidget odswidget-filter-summary">' +
            '    <li class="odswidget-filter-summary__active-filter" ' +
            '        ng-repeat="refinement in refinements">' +
            '        <a class="odswidget-filter-summary__active-filter-link" ' +
            '           ng-click="removeRefinement(refinement)">' +
            '            <span class="odswidget-filter-summary__active-filter-label">{{ refinement.label }}<span ng-if="refinement.contextsLabel && !hideContextsLabels"> ({{ refinement.contextsLabel }})</span></span>' +
            '            {{ refinement.value }}' +
            '        </a>' +
            '    </li>' +
            '    <li class="odswidget-filter-summary__clear-all" ng-show="clearAllButton && refinements.length > 0">' +
            '        <ods-clear-all-filters context="context"></ods-clear-all-filters>' +
            '    </li>' +
            '</ul>',
            scope: {
                context: '=',
                exclude: '@',
                clearAllButton: '=?',
                hideContextsLabels: '=?'
            },
            controller: ['$scope', '$attrs', 'translate', function ($scope, $attrs, translate) {
                // Parameters

                // default activated
                if (Boolean($scope.clearAllButton) !== $scope.clearAllButton) {
                    $scope.clearAllButton = true;
                }

                var excludes = $scope.exclude ? $scope.exclude.split(',') : [];

                // Methods

                var isParameterActive = function (context, parameterName) {
                    return context
                        && context.parameters
                        && excludes.indexOf(parameterName) === -1
                        && context.parameters[parameterName]
                        && context.parameters[parameterName] !== undefined;
                };

                var getFacetGroupLabel = function (context, facetGroupName) {
                    if (context.type === 'catalog') {
                        if (facetGroupName === 'features') {
                            // FIXME: Find a way to centralize all these special cases regarding the "schema" of the catalog
                            facetGroupName = 'view';
                        }
                        return translate(ODS.StringUtils.capitalize(facetGroupName));
                    } else {
                        for (var i = 0; i < context.dataset.fields.length; i++) {
                            var field = context.dataset.fields[i];
                            if (field.name == facetGroupName) {
                                return field.label;
                            }
                        }
                    }

                };

                $scope.removeRefinement = function (refinement) {
                    angular.forEach(refinement.contexts, function (context) {
                        if (!refinement.value) {
                            delete context.parameters[refinement.parameter];
                        } else {
                            var valueList = context.parameters[refinement.parameter];
                            if (!angular.isArray(valueList)) {
                                valueList = [valueList];
                            }
                            for (var i = 0; i < valueList.length; i++) {
                                if (valueList[i] == refinement.value) {
                                    valueList.splice(i, 1);
                                    if (valueList.length === 0) {
                                        delete context.parameters[refinement.parameter];
                                    }
                                    return;
                                }
                            }
                        }
                    });
                };
                
                var refreshRefinements = function (contexts) {
                    var refinements = [];
                    
                    var addRefinement = function (context, label, value, parameter) {
                        var inserted = false;
                        angular.forEach(refinements, function (refinement) {
                            if (refinement.parameter == parameter 
                                && refinement.label == label
                                && refinement.value == value) {
                                refinement.contexts.push(context);
                                inserted = true;
                            }
                        });
                        if (!inserted) {
                            refinements.push({
                                label: label,
                                value: value,
                                parameter: parameter,
                                contexts: [context]
                            });
                        }
                    };
                    
                    // build refinements list
                    
                    angular.forEach(contexts, function (context) {
                        if (context && context.parameters && (context.type === 'catalog' || context.dataset)) {
                            if (isParameterActive(context, 'q')) {
                                addRefinement(context, translate('Text search'), context.parameters['q'], 'q');
                            }
                            
                            if (isParameterActive(context, 'geofilter.polygon')) {
                                addRefinement(context, translate('Drawn area on the map'), context.parameters['geofilter.polygon'], 'geofilter.polygon');
                            }

                            // handle facets
                            angular.forEach(context.parameters, function (values, parameter) {
                                if (parameter.substring(0, 7) == 'refine.' && excludes.indexOf(parameter) === -1) {
                                    var label = getFacetGroupLabel(context, parameter.substring(7));
                                    if (!angular.isArray(values)) {
                                        values = [values];
                                    }
                                    angular.forEach(values, function (value) {
                                        addRefinement(context, label, value, parameter);
                                    });
                                }
                            });
                        }
                    });
                    
                    // build tags for refinements
                    angular.forEach(refinements, function (refinement) {
                        if (refinement.contexts.length < contexts.length) {
                            refinement.contextsLabel = refinement.contexts
                                .map(function (ctx) {
                                    return $attrs[ctx.name + 'Label'] || ctx.name
                                })
                                .join(', ')
                        }
                    });
                    
                    return refinements;
                };

                $scope.$watch('context', function (nv) {
                    $scope.refinements = refreshRefinements(angular.isArray(nv) ? nv : [nv]);
                }, true);
            }]
        };
    });
}());
;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsRedirectIfNotLoggedIn', ['ODSWidgetsConfig', 'config',function(ODSWidgetsConfig, config) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsRedirectIfNotLoggedIn
         * @scope
         * @restrict A
         * @description
         * This widget forces a redirect to the login page of the domain if the user is not logged in
         *
         */
        return {
            restrict: 'A',
            controller: ['$scope', '$location', function($scope, $location) {
                if (config.USER === "") {
                    $location.url("/login");
                }
            }]
        };
    }]);
}());
;(function () {
    'use strict';
    var mod = angular.module('ods-widgets');

    mod.directive('odsGeoSearch', ['ModuleLazyLoader', 'ODSWidgetsConfig', function (ModuleLazyLoader, ODSWidgetsConfig) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsGeoSearch
         * @scope
         * @restrict E
         * @param {CatalogContext|CatalogContext[]} context 
         * {@link ods-widgets.directive:odsCatalogContext Catalog context} or array of contexts to use.
         * 
         * @description
         * This widget displays a mini map with a draw-rectangle tool that can be used to search through a catalog.
         */
        return {
            restrict: 'E',
            replace: true,
            template: '' +
            '<div class="odswidget odswidget-geo-search">' +
            '    <div class="odswidget-geo-search__map"></div>' +
            '</div>',
            scope: {
                context: '='
            },
            link: function (scope, element) {
                var currentPolygonParameter;
                var polygonParameterRE = /.*polygon\(geographic_area,"(.*)"\).*/;

                var refineContexts = function (layer) {
                    var geoJson = layer.toGeoJSON();
                    currentPolygonParameter = ODS.GeoFilter.getGeoJSONPolygonAsPolygonParameter(geoJson.geometry);
                    var contexts = angular.isArray(scope.context) ? scope.context : [scope.context];
                    angular.forEach(contexts, function (context) {
                        context.parameters['q.geographic_area'] = '#polygon(geographic_area,"' + currentPolygonParameter + '")';
                    });
                    scope.$apply();
                };

                ModuleLazyLoader('leaflet').then(function () {
                    var map = new L.ODSMap(element.find('.odswidget-geo-search__map')[0], {
                        scrollWheelZoom: false,
                        basemapsList: [ODSWidgetsConfig.basemaps[0]],
                        disableAttribution: true
                    });

                    var drawnItems = new L.FeatureGroup();
                    map.addLayer(drawnItems);
                    var drawControl = new L.Control.Draw({
                        edit: {
                            featureGroup: drawnItems,
                            edit: false,
                            remove: false
                        },
                        draw: {
                            polyline: false,
                            marker: false,
                            polygon: false,
                            circle: false
                        }
                    });
                    map.addControl(drawControl);
                    map.setView([0, 0], 0);

                    var clearLayers = function () {
                        if (drawnItems.getLayers().length > 0) {
                            drawnItems.removeLayer(drawnItems.getLayers()[0]);
                        }
                    };

                    map.on('draw:drawstart', function () {
                        clearLayers();
                    });
                    map.on('draw:created', function (event) {
                        var layer = event.layer;
                        drawnItems.addLayer(layer);
                        refineContexts(layer);
                    });

                    scope.$watch('context', function (nv) {
                        // extract polygon parameter from query
                        var polygonParameter = false;
                        var contexts = angular.isArray(nv) ? nv : [nv];
                        angular.forEach(contexts, function (context) {
                            if (!polygonParameter && context.parameters && context.parameters['q.geographic_area']) {
                                var matches = polygonParameterRE.exec(context.parameters['q.geographic_area']);
                                if (matches.length > 0) {
                                    polygonParameter = matches[1];
                                }
                            }
                        });

                        if (polygonParameter !== currentPolygonParameter) {
                            clearLayers();
                            if (polygonParameter) {
                                var layer = L.geoJson(ODS.GeoFilter.getPolygonParameterAsGeoJSON(polygonParameter));
                                drawnItems.addLayer(layer);
                            }
                            currentPolygonParameter = polygonParameter;
                        }
                    }, true);
                });
            }
        };
    }]);

}());
;(function() {
    'use strict';

    angular.module('ods-widgets')
        .directive('odsGeotooltip', ['$timeout', 'ModuleLazyLoader', function ($timeout, ModuleLazyLoader) {
            /**
             * @ngdoc directive
             * @name ods-widgets.directive:odsGeotooltip
             * @scope
             * @restrict E
             * @param {Array|string} [coords=none] Coordinates of a point to display in the tooltip; either an array of two numbers as [latitude, longitude], or a string under the form of "latitude,longitude".
             * If you use a string, surround it with simple quotes to ensure Angular treats it as a string. If you are working with a record (for example using {@link ods-widgets.directive:odsResultEnumerator odsResultEnumerator}), you can directly use the content of a `geo_point_2d` field.
             * @param {Object} [geojson=none] GeoJSON object of a shape to display in the tooltip. If you are working with a record (for example using {@link ods-widgets.directive:odsResultEnumerator odsResultEnumerator}), you can directly use the content of a `geo_shape` field.
             * @param {Object} [record=none] A record object (for example from {@link ods-widgets.directive:odsResultEnumerator odsResultEnumerator}) from which the geometry will be taken (this is the `geometry` property of the record).
             * @param {number} [width=200] Width of the tooltip, in pixels.
             * @param {number} [height=200] Height of the tooltip, in pixels.
             * @param {number} [delay=500] Delay before the tooltip appears on hover, in milliseconds.
             *
             * @description
             * This directive, when used to surround a text, displays a tooltip showing a point and/or a shape in a map.
             *
             * @example
             *  <example module="ods-widgets">
             *      <file name="index.html">
             *          <!-- Display specific values -->
             *          <p>
             *              <ods-geotooltip coords="'48.858093,2.294694'">Nice place</ods-geotooltip>
             *          </p>
             *          <p>
             *              <ods-geotooltip coords="[48.841601, 2.284822]">Nice people</ods-geotooltip>
             *          </p>
             *
             *          <ods-dataset-context context="stations" stations-domain="public.opendatasoft.com" stations-dataset="jcdecaux_bike_data">
             *              <!-- Display values from records -->
             *              <ods-result-enumerator context="stations" max="1">
             *                  <div>
             *                      <!-- Using the value from a field with a "geo_point_2d" type -->
             *                      <ods-geotooltip coords="item.fields.position">Location</ods-geotooltip>
             *                      <!-- Directly passing a record -->
             *                      <ods-geotooltip record="item">Same location</ods-geotooltip>
             *                  </div>
             *              </ods-result-enumerator>
             *          </ods-dataset-context>
             *      </file>
             *  </example>
             */
            // The container is shared between directives to avoid performance issues
            var container = angular.element('<div id="odswidget-geotooltip" class="odswidget" style="opacity: 0; transition: opacity 200ms ease-out; position: fixed; z-index: 40000; visibility: hidden;"></div>');
            var map = null;
            var layerGroup = null;

            var displayTooltip = function(tippedElement, width, height, coords, geoJson, record) {
                // Make the container the right size
                var resized = false;
                if (width !== container.css('width') || height !== container.css('height')) {
                    resized = true;
                }
                container.css('width', width);
                container.css('height', height);

                // Position it at the right place
                var availableBottomSpace = jQuery(window).height()-(tippedElement.offset().top-jQuery(document).scrollTop());
                if (container.height() < availableBottomSpace) {
                    // There is enough space below: let's place the tooltip right below the element
                    container.css('top', tippedElement.height()+tippedElement.offset().top-jQuery(document).scrollTop()+5+'px');
                } else {
                    container.css('top', tippedElement.offset().top-jQuery(document).scrollTop()-5-container.height()+'px');
                }
                var availableRightSpace = jQuery(window).width()-(tippedElement.offset().left-jQuery(document).scrollLeft());
                if (container.width() < availableRightSpace) {
                    container.css('left', tippedElement.offset().left-jQuery(document).scrollLeft()+'px');
                } else {
                    container.css('left', tippedElement.offset().left-jQuery(document).scrollLeft()-container.width()+'px');
                }
                tippedElement.after(container);

                if (map === null) {
                    map = new L.map(container[0], {zoomControl: false});
                    var tileLayer = new L.TileLayer('http://otile{s}.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.png', {
                        minZoom: 1,
                        maxZoom: 16,
                        attribution: 'Tiles <a href="http://www.mapquest.com/" target="_blank">MapQuest</a> <img src="http://developer.mapquest.com/content/osm/mq_logo.png"> - Map data © <a href="http://www.openstreetmap.org/" target="_blank">OpenStreetMap</a>',
                        subdomains: '1234'
                    });
                    map.addLayer(tileLayer);
                } else if (resized) {
                    map.invalidateSize();
                }

                if (layerGroup !== null) {
                    map.removeLayer(layerGroup);
                }
                layerGroup = L.layerGroup();
                var bounds = new L.LatLngBounds();

                if (coords) {
                    if (angular.isString(coords)) {
                        coords = coords.split(',');
                    }
                    var point = new L.LatLng(coords[0], coords[1]);
                    var pointLayer = L.marker(point);
                    layerGroup.addLayer(pointLayer);
                    bounds.extend(point);
                }

                if (geoJson) {
                    if (angular.isString(geoJson)) {
                        geoJson = angular.fromJson(geoJson);
                    }
                    var geoJsonLayer = L.geoJson(geoJson);
                    layerGroup.addLayer(geoJsonLayer);
                    bounds.extend(geoJsonLayer.getBounds());
                }

                if (record && angular.isDefined(record.geometry)) {
                    var geoJsonLayer = L.geoJson(record.geometry);
                    layerGroup.addLayer(geoJsonLayer);
                    bounds.extend(geoJsonLayer.getBounds());
                }

                layerGroup.addTo(map);
                map.fitBounds(bounds, {reset: true});
                container.css('opacity', '1');
                container.css('visibility', 'visible');
            };

            var hideTooltip = function() {
                container.css('opacity', '0');
                $timeout(function() {
                    container.css('visibility', 'hidden');
                }, 200);
            };

            return {
                template: '<span ng-transclude style="border-bottom: 1px dotted #000000; cursor: help;" class="geotooltip"></span>',
                replace: true,
                restrict: 'E',
                transclude: true,
                scope: {
                    'coords': '=',
                    'width': '@',
                    'height': '@',
                    'delay': '@',
                    'geojson': '=',
                    'record': '='
                },
                link: function(scope, element, attrs) {
                    ModuleLazyLoader('leaflet').then(function() {
                        var tooltipWidth = (attrs.width || 200) + 'px';
                        var tooltipHeight = (attrs.height || 200) + 'px';
                        var tooltipPop = null;
                        var delay = attrs.delay || 500;

                        // Events
                        element.bind('mouseenter', function() {
                            if (delay === 0) {
                                displayTooltip(element, tooltipWidth, tooltipHeight, scope.coords, scope.geojson, scope.record);
                            } else {
                                tooltipPop = $timeout(function() {
                                    displayTooltip(element, tooltipWidth, tooltipHeight, scope.coords, scope.geojson, scope.record);
                                    tooltipPop = null;
                                }, delay);
                            }
                        });
                        element.bind('click', function() {
                            displayTooltip(element, tooltipWidth, tooltipHeight, scope.coords, scope.geojson, scope.record);
                            if (tooltipPop !== null) {
                                // Chances are we triggered the original timer
                                $timeout.cancel(tooltipPop);
                                tooltipPop = null;
                            }
                        });
                        element.bind('mouseleave', function() {
                            hideTooltip();
                            if (tooltipPop !== null) {
                                // We are currently counting down until the tooltip appearance, let's forget it
                                $timeout.cancel(tooltipPop);
                                tooltipPop = null;
                            }

                        });
                    });
                }
            };
        }]);
}());
;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.factory("requestData", ['ODSAPI', '$q', 'ChartHelper', 'AggregationHelper', function(ODSAPI, $q, ChartHelper, AggregationHelper) {
        var buildTimescaleX = function(x, timescale) {
            var xs = [];
            if (timescale == 'year') {
                xs.push(x + '.year');
            } else if (timescale == 'month') {
                xs.push(x + '.year');
                xs.push(x + '.month');
            } else if (timescale == 'day') {
                xs.push(x + '.year');
                xs.push(x + '.month');
                xs.push(x + '.day');
            } else if (timescale == 'hour') {
                xs.push(x + '.year');
                xs.push(x + '.month');
                xs.push(x + '.day');
                xs.push(x + '.hour');
            } else if (timescale == 'minute') {
                xs.push(x + '.year');
                xs.push(x + '.month');
                xs.push(x + '.day');
                xs.push(x + '.hour');
                xs.push(x + '.minute');
            } else if (timescale == 'month month') {
                xs.push(x + '.month');
            } else if (timescale == 'day day') {
                xs.push(x + '.day');
            } else if (timescale == 'day weekday') {
                xs.push(x + '.weekday');
            } else if (timescale == 'hour weekday') {
                xs.push(x + '.weekday');
                xs.push(x + '.hour');
            } else if (timescale == 'day month') {
                xs.push(x + '.yearday');
            } else if (timescale == 'hour hour') {
                xs.push(x + '.hour');
            } else {
                xs.push(x);
            }
            return xs;
        };
        var buildSearchOptions = function(query, timeSerieMode, precision, periodic) {
            var i, breakdown,
                xs,
                search_options = {
                    dataset: query.config.dataset,
                    x: [],
                    sort: query.sort || '',
                    maxpoints: query.maxpoints || ''
                };

            xs = buildTimescaleX(query.xAxis, query.timescale);
            for (i = 0; i < xs.length; i++) {
                search_options.x.push(xs[i]);
            }

            if (query.seriesBreakdown) {
                breakdown = query.seriesBreakdown;
                xs = buildTimescaleX(breakdown, query.seriesBreakdownTimescale);
                for (i = 0; i < xs.length; i++) {
                    search_options.x.push(xs[i]);
                }
            }
            if (timeSerieMode || query.seriesBreakdown) {
                search_options.sort = search_options.x.map(function(item) { return 'x.' + item; }).join(",");
            }

            // if (timeSerieMode){
            //     search_options.precision = precision;
            //     search_options.periodic = periodic;
            // }

            // // is there a timescale override ?
            // if(query.timescale){
            //      var tokens = query.timescale.split(' ');
            //      search_options.precision = tokens[0];
            //      search_options.periodic = tokens.length == 2 ? tokens[1] : '';
            // }
            return search_options;
        };
        var parseCustomExpression = function(serie, serieprefix, parentserie_for_subseries) {
            var regex = /([A-Z_-]*?)\((.*?)\)/g;
            var params2regex = /([A-Z_-]*?)\(([a-zA-Z0-9\.]+),\s?([0-9\.]+)\)/g;
            var aggregates_holder = parentserie_for_subseries || serie;
            var match;

            serie.compiled_expr = "" + serie.expr;
            aggregates_holder.aggregates = [];

            var options = {};
            match = regex.exec(serie.expr);
            while (match) {
                var extended_match = params2regex.exec(match[0]);
                if (extended_match && extended_match.length === 4) {
                    match = extended_match;
                }
                if (match && (match.length === 3 || match.length === 4)) {
                    if (match[2].indexOf('serie') === 0) {
                        var compiled = "operators." + match[1].toLowerCase() + ".apply(null, accumulation['" + match[2] + "']";
                        if (match.length === 4) {
                            compiled += ", " + match[3];
                        }
                        compiled += ")";
                        serie.compiled_expr = serie.compiled_expr.replace(match[0], compiled);
                        aggregates_holder.aggregates.push(match[2]);
                    } else { // we are really trying to get values from the index
                        options[serieprefix + '.func'] = match[1];
                        options[serieprefix + '.expr'] = match[2];
                        serie.compiled_expr += serie.compiled_expr.replace(match[0], 'y');
                    }
                }
                match = regex.exec(serie.expr);
            }

            return options;
        };
        var generateSerieOptions = function(serie, serie_name, aggregations, parent_for_subseries) {
            var options = {};
            if (serie.func === "CUSTOM") {
                return parseCustomExpression(serie, 'y.' + serie_name, parent_for_subseries);
            }
            options['y.' + serie_name + '.expr'] = serie.yAxis || serie.expr;

            options['y.' + serie_name + '.func'] = serie.func;
            options['y.' + serie_name + '.cumulative'] = serie.cumulative || false;
            if(serie.func === 'QUANTILES'){
                if (!serie.subsets){
                    serie.subsets = 50;
                }
                options['y.' + serie_name + '.subsets'] = serie.subsets || 50;
            }
            if (serie.func === "CONSTANT") {
                options['y.' + serie_name + '.expr'] = serie.yAxis || 0;
                options['y.' + serie_name + '.func'] = "AVG";
            }

            if (angular.isDefined(serie.multiplier) && serie.multiplier !== "" && serie.multiplier !== null) {
                options['y.' + serie_name + '.expr'] += " * " + serie.multiplier;
            }
            // if (!serie.color || serie.color.startsWith('dynamic-') || serie.color.startsWith('static-')) {
            //     options['agg.' + serie_name + '.func'] = ['MIN', 'MAX'].join(",");
            //     options['agg.' + serie_name + '.expr'] = serie_name;
            // }
            return options;
        };

        var addSeriesToSearchOptions = function(search_options, serie, serie_name) {
            if(serie.type && ChartHelper.isRangeChart(serie.type)) {
                if(search_options.sort ===  'y.' + serie_name) {
                    // cannot sort on range
                    search_options.sort = '';
                }
                // when trying to compute 2 quantiles on the same serie, optimize the call
                if (serie.charts[0].func === 'QUANTILES' && serie.charts[1].func === 'QUANTILES' && serie.charts[0].yAxis === serie.charts[1].yAxis) {
                    var temp_serie = angular.copy(serie.charts[0]);
                    temp_serie.subsets = serie.charts[0].subsets + "," + serie.charts[1].subsets;
                    addSeriesToSearchOptions(search_options, temp_serie, serie_name);
                } else {
                    if (angular.isDefined(serie.multiplier)) {
                        serie.charts[0].multiplier = serie.multiplier;
                        serie.charts[1].multiplier = serie.multiplier;
                    }
                    addSeriesToSearchOptions(search_options, serie.charts[0], serie_name + 'min');
                    addSeriesToSearchOptions(search_options, serie.charts[1], serie_name + 'max');
                }
            } else {
                angular.extend(search_options, generateSerieOptions(serie, serie_name));
            }
        };

        return function(queries, search_parameters, timeSerieMode, precision, periodic, domain, apikey, canceller) {
            var search_promises = [];
            var charts_by_query = [];
            var original_domain = domain;
            search_parameters = search_parameters || {};
            if (queries.length === 1) {
                if (['hour', 'minute', 'second'].indexOf(queries[0].timescale) !== -1) {
                    search_parameters.output_timezone = 'UTC';
                }
            } else if (['hour', 'minute', 'second'].indexOf(timeSerieMode) !== -1) {
                search_parameters.output_timezone = 'UTC';
            }

            angular.forEach(queries, function(query, query_index){
                var charts = {};
                var search_options = buildSearchOptions(query, timeSerieMode, precision, periodic);

                angular.forEach(query.charts, function(chart, index){
                    var serie_name = 'serie' + (query_index + 1) + '-' + (index + 1);
                    addSeriesToSearchOptions(search_options, chart, serie_name);
                    charts[serie_name] = chart;
                });

                // Analyse request
                // We have to build virtual contexts from parameters because we can source charts from multiple
                // datasets.
                domain = query.config.domain || original_domain;
                apikey = query.config.apikey || apikey;
                var virtualContext = {
                    domain: domain,
                    domainUrl: ODSAPI.getDomainURL(domain),
                    dataset: {'datasetid': search_options.dataset},
                    apikey: apikey,
                    parameters: {}
                };

                search_promises.push(ODSAPI.records.analyze(virtualContext, angular.extend({}, search_parameters, query.config.options, search_options), canceller.promise));
                charts_by_query.push(charts);
            });
            return {
                promise: $q.all(search_promises),
                charts: charts_by_query
            };
        };
    }]);

    mod.directive("odsHighchartsChart", ['colorScale',
                                         'requestData',
                                         'translate',
                                         'ModuleLazyLoader',
                                         'AggregationHelper',
                                         'ChartHelper',
                                         '$rootScope',
                                         'odsErrorService',
                                         '$q',
        function(colorScale, requestData, translate, ModuleLazyLoader, AggregationHelper, ChartHelper, $rootScope, odsErrorService, $q) {
        // parameters : {
        //     timescale: year, month, week, day, hour, month year, day year, day month, day week
        //     xLabel:
        //     singleAxis:
        //     singleAxisScale:
        //     singleAxisLabel:
        //     queries : [
        //         {
        //             config: {
        //                 dataset:
        //                 options:
        //             },
        //             xAxis:
        //             timescale:
        //             sort:
        //             maxpoints:
        //             charts: [
        //                 {
        //                     type:
        //                     [charts:]
        //                     yAxis:
        //                     yLabel:
        //                     func:
        //                     [subsets:]
        //                     scale:
        //                     color:
        //                     extras:
        //                     cumulative:
        //                 },
        //                 ...
        //             ]
        //         },
        //         ...
        //     ]
        // }
        var getDatasetUniqueId = function(dataset_id, domain) {
            var uniqueid;
            if (domain) {
                uniqueid = domain + "." + dataset_id;
            } else {
                uniqueid = ChartHelper.getDatasetUniqueId(dataset_id);
            }
            return uniqueid;
        };

        var getTimeSerieMode = function(parameters) {
            var precision, periodic, timeSerieMode;

            if(parameters.timescale && $.grep(parameters.queries, function(query){return query.sort;}).length === 0){
                 timeSerieMode = parameters.timescale;
                 var tokens = timeSerieMode.split(' ');
                 precision = tokens[0];
                 periodic = tokens.length == 2 ? tokens[1] : '';
            } else {
                timeSerieMode = false;
                precision = false;
                periodic = false;
            }

            return {
                'precision': precision,
                'periodic': periodic,
                'timeSerieMode': timeSerieMode
            };
        };

        var getGlobalOptions = function(parameters, precision, periodic, chartplaceholder, domain) {
            var height = chartplaceholder.height();
            var width = chartplaceholder.width();

            if (parameters.queries.length === 0) {
                parameters.xLabel = '';
            } else {
                if (!angular.isDefined(parameters.xLabel)) {
                    var datasetid = getDatasetUniqueId(parameters.queries[0].config.dataset, domain);
                    parameters.xLabel = ChartHelper.getXLabel(datasetid, parameters.queries[0].xAxis, parameters.timescale);
                }
            }

            if (angular.isUndefined(parameters.displayLegend)) {
                parameters.displayLegend = true;
            }
            var options = {
                chart: {},
                title: {text: ''},
                credits: {enabled: false},
                series: [],
                xAxis: {
                    title: {
                        text: parameters.xLabel
                    },
                    labels: {
                        step: 1,
                        rotation: -45,
                        align: 'right'
                    },
                    startOfWeek: 1,
                    minPadding: 0,
                    maxPadding: 0,
                    dateTimeLabelFormats: {
                        second: '%H:%M:%S',
                        minute: '%H:%M',
                        hour: '%H:%M',
                        day: '%e %b %y',
                        week: '%e. %b',
                        month: '%b \'%y',
                        year: '%Y'
                    }
                    // startOnTick: true,
                    // endOnTick: true,
                },
                legend: {
                    enabled: !!parameters.displayLegend
                },
                // legend: {
                //     align: 'right',
                //     verticalAlign: 'top',
                //     layout: 'vertical',
                //     x: -10,
                //     y: 50,
                //     floating: false,
                //     borderWidth: 0,
                //     width: width/5
                // },
                yAxis: [],
                plotOptions: {
                    series: {
                        animation: false
                    },
                    columnrange: {
                        pointPadding: 0,
                        groupPadding: 0,
                        borderWidth: 0,
                        tooltip: {
                            pointFormat: '<span style="color:{series.color}">{series.name}</span>: <b>{point.low}</b> - <b>{point.high}</b>'
                        }
                    },
                    arearange: {
                        tooltip: {
                            pointFormat: '<span style="color:{series.color}">{series.name}</span>: <b>{point.low}</b> - <b>{point.high}</b>'
                        }
                    },
                    areasplinerange: {
                        tooltip: {
                            pointFormat: '<span style="color:{series.color}">{series.name}</span>: <b>{point.low}</b> - <b>{point.high}</b>'
                        }
                    },
                    pie: {
                        tooltip: {
                            pointFormat: '<span style="color:{series.color}">{series.name}</span>: <b>{point.y} ({point.percentage:.1f}%)</b>'
                        }
                    },
                    treemap: {
                        tooltip: {
                            headerFormat: '',
                            pointFormat: '<span style="color:{series.color}">{point.name}</span>: {point.value}</b>'
                        },
                        layoutAlgorithm: 'squarified'
                    }
                },
                tooltip: {
                    valueDecimals: 2,
                    headerFormat: '{point.key}<br>',
                    pointFormat: '<span style="color:{series.color}">{series.name}</span>: <b>{point.y}</b>',
                    formatter: function (tooltip) {
                        var items = this.points || angular.isArray(this) ? this : [this],
                            series = items[0].series,
                            s;

                        // build the header
                        s = [tooltip.tooltipHeaderFormatter(items[0])];

                        // build the values
                        angular.forEach(items, function (item) {
                            series = item.series;
                            var value = (series.tooltipFormatter && series.tooltipFormatter(item)) || item.point.tooltipFormatter(series.tooltipOptions.pointFormat);
                            value = value.replace(/(\.|,)00</, '<');
                            value = value.replace(/(\.|,)00 /, ' ');
                            s.push(value);
                        });
                        // footer
                        s.push(tooltip.options.footerFormat || '');

                        return s.join('');
                    }
                },
                noData: {
                    style: {
                        fontFamily: 'Open Sans',
                        fontWeight: 'normal',
                        fontSize: '1.4em',
                        color: '#333',
                        opacity: '0.5'
                    }
                },
                lang: {
                    noData: translate("No data available yet")
                }
            };

            var xAxisType = ChartHelper.getFieldType(datasetid, parameters.queries[0].xAxis);

            if (precision) {
                options.xAxis.type = 'datetime';
                options.xAxis.maxZoom = 3600000; // fourteen days
                options.chart.zoomType = 'xy';

                if (periodic) {
                    options.xAxis.showFirstLabel = true;
                }
            } else if (['double', 'int'].indexOf(xAxisType) !== -1) {
                options.xAxis.type = "linear";
            } else {
                options.xAxis.type = "category";
                options.xAxis.categories = [];
            }

            if (periodic === "month") {  // month of year
                options.xAxis.labels.format = "{value: %B}";
            } else if (periodic === "weekday") {  // day of week
                options.xAxis.labels.format = "{value: %A}";
                if (precision === "hour") {
                    options.xAxis.labels.format = "{value: %A %Hh}";
                }
            } else if (periodic === "day") {  // day of month
                options.xAxis.labels.format = "{value: %d}";
            } else if (periodic === "hour") {
                options.xAxis.labels.format = "{value: %H}";
            }

            if (!precision) {
                options.xAxis.labels.formatter = function() {
                    if (this.value.length > 11) {
                        return this.value.substring(0, 8) + '...';
                    } else {
                        return this.value;
                    }
                };
            }

            if(parameters.singleAxis) {
                var yAxisParamaters = {
                    color: "#000000",
                    scale: parameters.singleAxisScale,
                    yRangeMin: parameters.yRangeMin,
                    yRangeMax: parameters.yRangeMax,
                };

                options.yAxis = [buildYAxis(parameters.singleAxisLabel, yAxisParamaters, false)];
            }

            return options;
        };

        var colors = {};
        var colorsIndex = 0;
        var getSerieOptions = function(parameters, yAxisesIndexes, query, serie, suppXValue, domain, scope) {
            var datasetid = ChartHelper.getDatasetId({dataset: {datasetid: query.config.dataset}, domain: domain});
            var yLabel = ChartHelper.getYLabel(datasetid, serie);
            var serieColor;
            if (!suppXValue && serie.type !== 'pie') {
                serieColor = colorScale.getUniqueColor(serie.color);
            } else if ( serie.type === 'pie') {
                if (!serie.extras) {
                    serie.extras = {};
                }
                if (serie.innersize) {
                    serie.extras.innerSize = serie.innersize;
                }
                if (serie.labelsposition === 'inside') {
                    serie.extras.dataLabels = {distance:  -50};
                }

                serie.extras.colors = colorScale.getColors(serie.color);
            } else {
                if (!colors[suppXValue + serie.color]) {
                    colors[suppXValue + serie.color] = colorScale.getColorAtIndex(serie.color, colorsIndex);
                    colorsIndex++;
                }
                serieColor = colors[suppXValue + serie.color];
            }

            var options = angular.extend({}, {
                name: suppXValue ? suppXValue : yLabel,
                color: serieColor,
                type: serie.type,
                yAxis: parameters.singleAxis ? 0 : yAxisesIndexes[datasetid][yLabel],
                marker: {
                    enabled: (serie.type === 'scatter'),
                    radius: 3
                },
                shadow: false,
                tooltip: {},
                // zIndex: 
                data: [],
                stacking: query.stacked ? query.stacked : null
            }, serie.extras);

            if (!options.dataLabels) {
                options.dataLabels = {};
            }

            if (serie.displayValues) {
                options.dataLabels.enabled = true;
                options.dataLabels.color = 'black';
                if (serie.type !== 'treemap') {
                    options.dataLabels.formatter = function() {
                        var label = Highcharts.numberFormat(this.point.y, 2);
                        return label.replace(/[,\.]00$/, '');
                    };
                }
            }
            if (serie.displayUnits && serie.func !== 'COUNT') {
                var unit = ChartHelper.getFieldUnit(datasetid, serie.yAxis);
                if (unit) {
                    options.tooltip.valueSuffix = ' ' + unit;
                    if (serie.displayValues && serie.type !== 'treemap') {
                        var _formatter = options.dataLabels.formatter;
                        options.dataLabels.formatter = function() {
                            return _formatter.bind(this)(this.point.y) + ' ' + unit;
                        };
                    }
                }
            }

            if (serie.refineOnClickCtrl) {
                options.point = {
                    events: {
                        'click': function(event) {
                            var value = this.category || this.name;
                            serie.refineOnClickCtrl.refineOnValue(value);
                            scope.$apply();
                        }
                    }
                };
                options.cursor = 'pointer';
            }

            options = angular.extend(options, ChartHelper.resolvePosition(serie.position));
            delete options.position;
            return options;
        };

        var buildDatePattern = function(object) {
            var datePattern = '';
            if (angular.isObject(object) && ('year' in object || 'month' in object || 'day' in object || 'hour' in object || 'minute' in object || 'weekday' in object)) {
                if(! ('year' in object)){
                    if('month' in object){
                        datePattern = '%B';
                    }
                    if('day' in object){
                        if('month' in object){
                            datePattern = '%e %B';
                        } else {
                            datePattern = '%e';
                        }
                    }
                    if('weekday' in object) {
                        datePattern = '%a';
                        if('hour' in object){
                            datePattern += ' %Hh';
                        }
                    } else if ('hour' in object){
                         datePattern = '%Hh';
                    }
                } else {
                    if('day' in object){
                        datePattern += ' %e';
                    }
                    if('month' in object){
                        datePattern += ' %B';
                    }
                    datePattern += ' %Y';

                    if('hour' in object){
                        if('minute' in object){
                             datePattern += ' %Hh%M';
                        } else {
                            datePattern +=' %Hh';
                        }
                    }
                }
            }
            return datePattern;
        };

        var getContextualizedSeriesOptions = function(x, timeSerieMode) {
            var tooltip = {};

            if (timeSerieMode) {
                // options.pointPadding = 0;
                // options.groupPadding = 0;
                // options.borderWidth = 0;
                tooltip.xDateFormat = buildDatePattern(x);
            }

            return tooltip;
        };
        
        var updateXAxisOptionsFromData = function(x, options, timeSerieMode) {
            if (timeSerieMode && angular.isObject(x)) {
                if ('second' in x){
                    options.minTickInterval = Date.UTC(2010, 1, 1, 1, 1, 2) - Date.UTC(2010, 1, 1, 1, 1, 1);
                } else if ('minute' in x){
                    options.minTickInterval = Date.UTC(2010, 1, 1, 1, 2) - Date.UTC(2010, 1, 1, 1, 1);
                } else if ('hour' in x){
                    options.minTickInterval = Date.UTC(2010, 1, 1, 2) - Date.UTC(2010, 1, 1, 1);
                } else if ('weekday' in x){
                    options.minTickInterval = Date.UTC(2010, 1, 2) - Date.UTC(2010, 1, 1);
                } else if ('day' in x || 'yearday' in x) {
                    options.minTickInterval = Date.UTC(2010, 1, 2) - Date.UTC(2010, 1, 1);
                } else if ('month' in x){
                    options.minTickInterval = Date.UTC(2010, 1, 1) - Date.UTC(2010, 0, 1);
                } else if ('year' in x){
                    options.minTickInterval = Date.UTC(2010, 0, 1) - Date.UTC(2009, 0, 1);
                }
            }
        };

        var buildYAxis = function(yLabel, chart, opposite, stacked) {
            var hasMin = typeof chart.yRangeMin !== "undefined" && chart.yRangeMin !== '';
            var hasMax = typeof chart.yRangeMax !== "undefined" && chart.yRangeMax !== '';
            var yAxis = {
                title: {
                    text: yLabel || "",
                    style: {
                        color: chart.color
                    }
                },
                labels: {
                    style: {
                        color: chart.color
                    }
                },
                type: chart.scale || 'linear',
                min: hasMin ? chart.yRangeMin : null,
                max: hasMax ? chart.yRangeMax : null,
                startOnTick: hasMin ? false : true,
                endOnTick: hasMax ? false : true,
                opposite: opposite
            };

            if (stacked) {
                yAxis.stackLabels = {
                    enabled: true,
                    style: {
                        fontWeight: 'bold'
                    }
                };
            }

            return yAxis;
        };

        var getDateFromXObject = function(x, minDate) {
            var minYear = minDate ? minDate.getUTCFullYear() : 2000;
            var minMonth = minDate ? minDate.getUTCMonth() : 0;
            var minDay = minDate ? minDate.getUTCDate() : 1;
            var minHour = minDate ? minDate.getUTCHours() : 0;
            var minMinute = minDate ? minDate.getUTCMinutes() : 0;

            if (angular.isObject(x) && ('year' in x || 'month' in x || 'day' in x || 'hour' in x || 'minute' in x || 'weekday' in x || 'yearday' in x)) {
                // default to 2000 because it's a leap year
                var date = new Date(Date.UTC(x.year || minYear, x.month-1 || 0, x.day || 1, x.hour || 0, x.minute || 0));
                // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#Two digit years
                date.setUTCFullYear(x.year || minYear);
                if (!('month' in x)) date.setUTCMonth(minMonth);
                if (!('day' in x)) date.setUTCDate(minDay);
                if (!('hour' in x)) date.setUTCHours(minHour);
                if (!('minute' in x)) date.setUTCMinutes(minMinute);
                if(!('year' in x)){
                    if('weekday' in x){
                        date.setUTCDate(date.getUTCDate() + 7 - date.getUTCDay() + x.weekday );
                    }
                    if('yearday' in x){
                        date.setUTCDate(0 + x.yearday );
                    }
                }
                if('day' in x){
                    // handle bisextil years
                    if(x.day == 29 && x.month == 2 && !x.year) {
                        date.setUTCDate(28);
                        date.setUTCMonth(1);
                    }
                } else {
                    if('month' in x){
                        date.setUTCDate(16);
                    }
                }
                return date;
            }
        };

        function getXValue(dateFormatFunction, datePattern, x, minDate, xAxisType) {
            var date = getDateFromXObject(x, minDate),
                xValue;

            if (date && xAxisType === "datetime") {
                xValue = date.getTime();
            } else if (date) {
                xValue = dateFormatFunction(datePattern, date);
            } else if (typeof x === "undefined") {
                xValue = undefined;
            } else if (angular.isObject(x) && x.week) {
                xValue = translate("Week") + " " + x.week;
            } else if (xAxisType === "linear") {
                xValue = x;
            } else {
                xValue = "" + x;
            }
            return xValue;
        }

        function getValidYValue(value, chart){
            if (chart.func === 'QUANTILES' && chart.subsets) {
                // elastic search now returns a float value as key, for now we just hack the thing to get the correct key
                if (typeof value[chart.subsets + ".0"] === "undefined") {
                    return null;
                } else {
                    return value[chart.subsets + ".0"];
                }
            } else {
                if (typeof value === "undefined") {
                    return null;
                } else {
                    return value;
                }
            }
        }

        function compileAggrValue(scope, compiled_expr, accumulations, aggregates) {
            var valueY;
            try {
                valueY = scope.$eval(compiled_expr, {
                        operators: Math,
                        accumulation: function(accumulations, needed_aggregates) {
                            var res = {};
                            angular.forEach(needed_aggregates, function(k) {
                                res[k] = accumulations[k];
                            });
                            return res;
                        }(accumulations, aggregates),
                        console: console
                    }
                );
            } catch (e) {
                console.warn("Error while compiling aggregation value with expr", compiled_expr);
            }

            return valueY;
        }

        return {
            restrict: 'A',
            replace: true,
            require: ["odsHighchartsChart"],
            scope: {
                parameters: '=parameters',
                domain: '=',
                apikey: '=',
                colors: '=',
                contexts: '=?'
            },

            template: '' +
            '<div class="ods-chart">' +
            '    <div class="ods-chart__loading" ng-show="loading">' +
            '        <ods-spinner></ods-spinner>' +
            '    </div>' +
            '    <div class="chartplaceholder"></div>' +
            '    <debug data="chartoptions"></debug>' +
            '</div>',
            controller: ['$scope', '$element', '$attrs', function($scope) {
                var timeSerieMode, precision, periodic, yAxisesIndexes, domain,
                    that = this;

                $scope.$watch('contexts', function(nv,ov) {
                    if (nv && nv.length > 0) {
                        var i;
                        for (i = 0; i < nv.length; i++) {
                            $scope[nv[i].name] = nv[i];
                        }
                    }
                }, true);

                this.highchartsLoaded = function(Highcharts, element) {
                    var chartplaceholder = element.find('.chartplaceholder');

                    function formatRowX(value){
                        if (periodic) {
                            console.warn('formatRowX on periodic value should not be used anymore');
                            switch(periodic){
                                // FIXME should compute a proper date
                                case 'month':
                                    return [
                                    translate('Jan'),
                                    translate('Feb'),
                                    translate('Mar'),
                                    translate('Apr'),
                                    translate('May'),
                                    translate('Jun'),
                                    translate('Jul'),
                                    translate('Aug'),
                                    translate('Sep'),
                                    translate('Oct'),
                                    translate('Nov'),
                                    translate('Dec')][value.month - 1];
                                case 'weekday':
                                    return [
                                    translate('Monday'),
                                    translate('Tuesday'),
                                    translate('Wednesday'),
                                    translate('Thursday'),
                                    translate('Friday'),
                                    translate('Saturday'),
                                    translate('Sunday')][value.weekday];
                                case 'day':
                                    return value.day;
                                default:
                                    return "" + value;
                            }
                        } else {
                            if (angular.isObject(value) && ("day" in value || "month" in value || "year" in value)) {
                                var date = new Date(Date.UTC(value.year, value.month-1 || 0, value.day || 1, value.hour || 0, value.minute || 0));
                                return Highcharts.dateFormat("%Y-%m-%d", date);
                            }
                            return "" + value;
                        }
                    }

                    var last_parameters_hash;
                    var request_canceller = $q.defer();
                    that.update = function(parameters) {
                        if (typeof parameters === "undefined") {
                            parameters = $scope.parameters;
                        }

                        // make a copy of the parameters to make sure that we will not trigger any external watches by modifying this object
                        parameters = angular.copy(parameters);

                        if (!parameters || !parameters.queries || parameters.queries.length === 0) {
                            if ($scope.chart) {
                                angular.element($scope.chart.container).empty();
                            }
                            return;
                        }

                        var search_promises = [];
                        timeSerieMode = undefined;
                        precision = undefined;
                        periodic = undefined;
                        yAxisesIndexes = {};

                        // make sure all required datasets metadata are loaded
                        for (var i = 0; i < parameters.queries.length; i++) {
                            try {
                                getDatasetUniqueId(parameters.queries[i].config.dataset, domain);
                            } catch (e) {
                                ChartHelper.onLoad(that.update);
                                return;
                            }
                        }
                        var timeserie = getTimeSerieMode(parameters);
                        timeSerieMode = timeserie.timeSerieMode;
                        precision = timeserie.precision;
                        periodic = timeserie.periodic;

                        var useUTC = false;
                        if (periodic && precision === "hour") {
                            useUTC = true;
                        }

                        Highcharts.setOptions({
                            global: {'useUTC': useUTC}
                        });

                        var options = getGlobalOptions(parameters, precision, periodic, chartplaceholder, domain);
                        $scope.chartoptions = options;
                        angular.forEach(parameters.queries, function(query) {
                            var datasetid = ChartHelper.getDatasetId({dataset: {datasetid: query.config.dataset}, domain: query.config.domain});
                            if (angular.isUndefined(yAxisesIndexes[datasetid])) {
                                yAxisesIndexes[datasetid] = {};
                            }

                            angular.forEach(query.charts, function(chart) {
                                var yLabel = ChartHelper.getYLabel(datasetid, chart);
                                if (!parameters.singleAxis && angular.isUndefined(yAxisesIndexes[datasetid][yLabel])) {
                                    // we dont yet have an axis for this column :
                                    // Create axis and register it in yAxisesIndexes
                                    var yAxis = buildYAxis(yLabel, chart, !!(options.yAxis.length % 2), !!(chart.displayStackValues));
                                    yAxisesIndexes[datasetid][yLabel] = options.yAxis.push(yAxis) - 1;
                                }

                                if( chart.type == 'bar') {
                                    // bar chart invert axis, thus we have to cancel the label rotation
                                    options.xAxis.labels.rotation = 0;
                                }
                                chart.colorScale = colorScale.getScale(chart.color);

                                if (!ChartHelper.allowThresholds(chart.type)) {
                                    delete chart.thresholds;
                                } else if (chart.thresholds) {
                                    for (var i = 0; i < chart.thresholds.length; i++) {
                                        if (!angular.isNumber(chart.thresholds[i].value)) {
                                            chart.thresholds.splice(i, 1);
                                        }
                                    }
                                    chart.thresholds = chart.thresholds.sort(function(a, b) {
                                        return a.value > b.value;
                                    });
                                }
                            });

                        });


                        function pushValues(serie, categoryIndex, scale, valueX, valueY, color, thresholds) {
                            var min, max, i;
                            if (options.xAxis.type === 'datetime' || options.xAxis.type === 'linear') {
                                if (typeof valueY === 'object') {
                                    min = valueY[0];
                                    max = valueY[1];
                                    if (scale === 'logarithmic' && (min <= 0 || max <= 0)) {
                                        serie.data.push([
                                            valueX,
                                            null,
                                            null
                                        ]);
                                    } else {
                                        serie.data.push([
                                            valueX,
                                            min,
                                            max
                                        ]);
                                    }
                                } else if (serie.type == 'pie') {
                                    if (options.xAxis.type === 'datetime') {
                                        serie.data.push({
                                            name: Highcharts.dateFormat(serie.tooltip.xDateFormat, new Date(valueX)),
                                            y: valueY
                                        });
                                    } else {
                                        serie.data.push({
                                            name: "" + valueX,
                                            y: valueY
                                        });
                                    }
                                } else if (serie.type == 'treemap') {
                                    if (options.xAxis.type === 'datetime') {
                                        serie.data.push({
                                            name: Highcharts.dateFormat(serie.tooltip.xDateFormat, new Date(valueX)),
                                            value: valueY
                                        });
                                    } else {
                                        serie.data.push({
                                            name: "" + valueX,
                                            y: valueY
                                        });
                                    }
                                } else {
                                    if (scale === 'logarithmic' && valueY <= 0) {
                                        serie.data.push([
                                            valueX,
                                            null
                                        ]);
                                    } else {
                                        serie.data.push([
                                            valueX,
                                            valueY
                                        ]);
                                    }
                                    if (thresholds.length > 0) {
                                        for (i = thresholds.length - 1; i >= 0; i--) {
                                            if (valueY >= thresholds[i].value) {
                                                serie.data[serie.data.length - 1] = {
                                                    'x': serie.data[serie.data.length - 1][0],
                                                    'y': serie.data[serie.data.length - 1][1],
                                                    'color': thresholds[i].color
                                                };
                                                break;
                                            }
                                        }
                                    }
                                }
                            } else { // categories
                                // push row data into proper serie data array
                                if(serie.type == 'pie') {
                                    serie.data[categoryIndex] = {
                                        name: formatRowX(valueX),
                                        y: valueY
                                    };
                                } else if (serie.type == 'treemap') {
                                    serie.data[categoryIndex] = {
                                        name: formatRowX(valueX),
                                        value: valueY
                                    };
                                } else {
                                    if (typeof valueY === 'object') {
                                        min = valueY[0];
                                        max = valueY[1];
                                        if (scale === 'logarithmic' && (min <= 0 || max <= 0)) {
                                            serie.data[categoryIndex] = [null, null];
                                        } else {
                                            serie.data[categoryIndex] = [min, max];
                                        }
                                    } else {
                                        if (scale === 'logarithmic' && valueY <= 0) {
                                            serie.data[categoryIndex] = null;
                                        } else {
                                            serie.data[categoryIndex] = valueY;
                                        }
                                    }
    
                                    if (thresholds.length > 0) {
                                        for (i = thresholds.length - 1; i >= 0; i--) {
                                            if (valueY >= thresholds[i].value) {
                                                serie.data[categoryIndex] = {
                                                    'y': serie.data[categoryIndex],
                                                    'color': thresholds[i].color
                                                };
                                                break;
                                            }
                                        }
                                    }
                                }
                            }

                        }

                        request_canceller.resolve("new request coming, cancelling current one");
                        request_canceller = $q.defer();
                        $scope.loading = true;
                        var requestPromise = requestData(parameters.queries, $scope.searchoptions, timeSerieMode, precision, periodic, $scope.domain, $scope.apikey, request_canceller);
                        requestPromise.promise.then(function(http_calls) {
                            $scope.loading = false;
                            var charts_by_calls = requestPromise.charts;
                            // If there is both periodic & datetime timescale, we need to find the min date to properly offset the periodic data
                            var minDate, i;
                            if (precision) {
                                for (var h = 0; h < http_calls.length; h++) {
                                    var http_call = http_calls[h];
                                    for (i = 0; i < http_call.data.length; i++) {
                                        var row = http_call.data[i];
                                        if(row.x.year && angular.isNumber(row.x.year)){
                                            var date = new Date(Date.UTC(row.x.year, row.x.month-1 || 0, row.x.day || 1, row.x.hour || 0, row.x.minute || 0));
                                            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date#Two digit years
                                            date.setFullYear(row.x.year);
                                            if(minDate === undefined || date < minDate) {
                                                minDate = date;
                                            }
                                        }
                                    }
                                }
                            }

                            var registered_series = [];
                            for (i = 0; i < parameters.queries.length; i++) {
                                if (!parameters.queries[i].seriesBreakdown) {
                                    for (var j = 0; j < parameters.queries[i].charts.length; j++) {
                                        registered_series.push('serie' + (i + 1) + '-' + (j + 1));
                                        options.series.push(false);
                                    }
                                }
                            }
                            var handleSerie = function(serieHash, parameters, options, serie_options, query, serie, valueX, valueY, rawValueX) {
                                var serieIndex = registered_series.indexOf(serieHash);
                                var color = serie.colorScale(valueY).hex();
                                var categoryIndex;

                                if (serieIndex === -1) {
                                    options.series.push(getSerieOptions(parameters, yAxisesIndexes, query, serie, rawValueX, query.config.domain || domain, $scope));
                                    serieIndex = registered_series.push(serieHash) - 1;
                                } else if (!options.series[serieIndex]) {
                                    options.series[serieIndex] = getSerieOptions(parameters, yAxisesIndexes, query, serie, rawValueX, query.config.domain || domain, $scope);
                                }

                                if (options.xAxis.type === "category" && (categoryIndex = options.xAxis.categories.indexOf(valueX)) === -1) {
                                    categoryIndex = options.xAxis.categories.length;
                                    options.xAxis.categories.push(valueX);
                                }

                                angular.extend(options.series[serieIndex].tooltip, serie_options);
                                if (!rawValueX && serie.type !== 'pie') {
                                    pushValues(options.series[serieIndex], categoryIndex, parameters.singleAxisScale || serie.scale, valueX, valueY, serie.colorScale(valueY).hex(), serie.thresholds || []);
                                } else {
                                    pushValues(options.series[serieIndex], categoryIndex, parameters.singleAxisScale || serie.scale, valueX, valueY, options.series[serieIndex].color, serie.thresholds || []);
                                }
                            };


                            angular.forEach(http_calls, function(http_call, index) {
                                var results, aggregations, i, j;
                                if (!http_call.data || http_call.data.length === 0) {
                                    return;
                                }

                                if (http_call.data.results) {
                                    results = http_call.data.results;
                                    aggregations = http_call.data.aggregations;
                                } else {
                                    results = http_call.data;
                                }

                                if (results.length === 0) return;

                                // first thing, we should analyze the first record and get x values
                                var query = parameters.queries[index];
                                var charts = charts_by_calls[index];
                                var xAxis = query.xAxis;
                                var multipleXs = !!query.seriesBreakdown;
                                var nbSupplementaryXs = 1;
                                var serie_options = getContextualizedSeriesOptions(multipleXs ? results[0].x[xAxis]: results[0].x, options, timeSerieMode);

                                // transform data format to a format understood by the chart plugin
                                updateXAxisOptionsFromData(multipleXs ? results[0].x[xAxis]: results[0].x, options.xAxis, timeSerieMode);

                                // generate a list of all series to make sure always have a value for all of them
                                query.defaultValues = {};
                                angular.forEach(charts, function(chart, name) {
                                    query.defaultValues[name] = null;
                                });

                                // use server side aggregations
                                if (aggregations) {
                                    angular.forEach(aggregations, function(aggr, key) {
                                        var min, max;
                                        if (key.endsWith("min")) {
                                            key = key.replace('min', '');
                                            min = aggr.min;
                                            max = aggregations[key + 'max'].max;
                                        } else if (key.endsWith("max")) {
                                            // ignore, handled in "min"
                                            return;
                                        } else if (charts[key].charts && charts[key].charts[0].func === "QUANTILES" && charts[key].charts[1].func === "QUANTILES") {
                                            min = aggr.min[charts[key].charts[0].subset + ".0"];
                                            min = aggr.max[charts[key].charts[1].subset + ".0"];
                                        } else {
                                            min = aggr.min;
                                            max = aggr.max;
                                        }

                                        charts[key].colorScale = colorScale.getScale(charts[key].color, min, max);
                                    });
                                }

                                var accumulate_x = false;
                                var series_to_accumulate = [];
                                var accumulations_x = [];
                                var accumulations_y = {};
                                var nb_series = parameters.queries[index].charts.length;
                                for (j = 0; j < nb_series; j++) {
                                    var chart = parameters.queries[index].charts[j];
                                    if (chart.aggregates) {
                                        for (var a = 0; a < chart.aggregates.length; a++) {
                                            var aggr = chart.aggregates[a];
                                            if (aggr && series_to_accumulate.indexOf(aggr) === -1) {
                                                series_to_accumulate.push(aggr);
                                                accumulations_y[aggr] = [];
                                            }
                                        }
                                    }
                                    if (chart.compiled_expr) {
                                        accumulate_x = true;
                                    }
                                }

                                for (i = 0; i < results.length; i++) {
                                    var row = results[i];
                                    angular.extend({}, query.defaultValues, row);
                                    var valueX = getXValue(Highcharts.dateFormat, serie_options.xDateFormat, multipleXs ? row.x[xAxis]: row.x, minDate, options.xAxis.type);
                                    j = 0;
                                    // iterate on all entries in the row...
                                    angular.forEach(row, function(rawValueY, keyY) {
                                        var valueY;
                                        var serie_name;
                                        // ...and avoid the x entry
                                        if (keyY !== "x") {
                                            if (keyY.endsWith('min')) {
                                                return;
                                            } else if (keyY.endsWith('max')) {
                                                serie_name = keyY.replace('max', '');
                                            } else {
                                                serie_name = keyY;
                                            }

                                            var serie = charts[serie_name];
                                            if (keyY.endsWith('max')) {
                                                valueY = [getValidYValue(row[keyY.replace('max', 'min')], serie.charts[0]), getValidYValue(rawValueY, serie.charts[1])];
                                            } else if (serie.charts) {
                                                valueY = [getValidYValue(rawValueY, serie.charts[0]), getValidYValue(rawValueY, serie.charts[1])];
                                            } else {
                                                valueY = getValidYValue(rawValueY, serie);
                                            }

                                            if (!multipleXs) {
                                                handleSerie("" + serie_name, parameters, options, serie_options, query, serie, valueX, valueY);
                                                if (series_to_accumulate.indexOf(serie_name) >= 0) {
                                                    accumulations_y[serie_name].push(valueY);
                                                }
                                            } else {
                                                angular.forEach(row.x, function(rawValueX, keyX) {
                                                    if (keyX !== xAxis) {
                                                        rawValueX = getXValue(Highcharts.dateFormat, buildDatePattern(rawValueX), rawValueX, minDate, false);

                                                        handleSerie("" + serie_name + keyX + rawValueX, parameters, options, serie_options, query, serie, valueX, valueY, rawValueX);
                                                        if (series_to_accumulate.indexOf(serie_name) >= 0) {
                                                            accumulations_y[serie_name].push(valueY);
                                                        }
                                                    }
                                                });
                                            }
                                            if (accumulate_x) {
                                                accumulations_x.push(valueX);
                                            }
                                            j++;
                                        }
                                    });
                                }

                                if (accumulate_x) {
                                    accumulations_x.sort(function(a, b) {
                                        return a - b;
                                    });
                                    // remove duplicates in accumulations_x
                                    for (i = accumulations_x.length - 1; i > 0; i--) {
                                        if (accumulations_x[i] == accumulations_x[i - 1]) {
                                            accumulations_x.splice(i, 1);
                                        }
                                    }
                                }

                                for (i = 0; i < query.charts.length; i++) {
                                    if (query.charts[i].aggregates) {
                                        var serie = query.charts[i];
                                        var valueY = compileAggrValue($scope, serie.compiled_expr, accumulations_y, serie.aggregates);
                                        for (var j = 0; j < accumulations_x.length; j++) {
                                            handleSerie("aggr" + index + "-" + i, parameters, options, serie_options, query, serie, accumulations_x[j], valueY);
                                        }
                                    }
                                }
                            });

                            var categories = options.xAxis.categories;
                            
                            if (categories) {
                                for (i = 0; i < options.series.length; i++) {
                                    for (var k = 0; k < categories.length; k++) {
                                        if (typeof options.series[i].data[k] === "undefined") {
                                            options.series[i].data[k] = null;
                                        }
                                    }
                                }
                            }

                            // render the charts
                            if ($scope.chart && options.chart.renderTo) {
                                $scope.chart.destroy();
                                chartplaceholder = $element.find('.chartplaceholder');
                            }
                            options.chart.renderTo = chartplaceholder[0];
                            try {
                                if (options.series.length > 500) {
                                    odsErrorService.sendErrorNotification(translate("There are too many series to be displayed correctly, try to refine your query a bit."));
                                    options.series = options.series.slice(0, 10);
                                }
                                $scope.chart = new Highcharts.Chart(options, function() {});
                            } catch (errorMsg) {
                                if(errorMsg.indexOf && errorMsg.indexOf('Highcharts error #19') === 0){
                                    // too many ticks
                                    odsErrorService.sendErrorNotification(translate("There was too many points to display, the maximum number of points has been decreased."));
                                    angular.forEach($scope.parameters.queries, function(query){
                                        query.maxpoints = 20;
                                    });
                                } else {
                                    if (angular.isString(errorMsg)) {
                                        odsErrorService.sendErrorNotification(errorMsg);
                                    } else {
                                        odsErrorService.sendErrorNotification(errorMsg.message);
                                    }
                                }
                            }
                        }, function(reason) {
                            $scope.loading = false;
                        });
                    };
                };
            }],
            link: function(scope, element, attrs, ctrls) {
                var chartController = ctrls[0];
                ModuleLazyLoader('highcharts').then(function() {
                    chartController.highchartsLoaded(Highcharts, element);
                    scope.$watch('parameters', function(nv, ov) {
                        chartController.update(nv);
                    }, true);
                });
            }
        };
    }]);

    mod.directive('odsHighcharts', ['colorScale', function(colorScale) {
        /**
         * @deprecated
         * @ngdoc directive
         * @name ods-widgets.directive:odsHighcharts
         * @restrict E
         * @scope
         * @param {DatasetContext} context {@link ods-widgets.directive:odsDatasetContext Dataset Context} to use
         * @param {string} fieldX Name of the field used for the X axis
         * @param {string} expressionY Expression for the Y axis, typically a field name. Optional if the function (function-y) is 'COUNT'.
         * @param {string} functionY Function applied to the expression for the Y axis: AVG, COUNT, MIN, MAX, STDDEV, SUM
         * @param {string} timescale If the X axis is time-based, then you can specify the timescale (year, month, week, day, hour)
         * @param {string} chartType One of the following chart types: line, spline, area, areaspline, column, bar, pie
         * @param {string} color The color (or comma-separated list of colors in case of a pie chart) to draw the chart in. Colors are in hex color code (e.g. *#2f7ed8*).
         * If not specified, the colors from {@link ods-widgets.ODSWidgetsConfigProvider ODSWidgetsConfig.chartColors} will be used if they are configured, else Highcharts default colors.
         * @param {string} [sort=none] How to sort the data in the chart: *x* or *-x* to sort or reverse sort on the X axis; *y* or *-y* to sort or reverse sort on the Y axis.
         * @param {number} [maxpoints=50] Maximum number of points to chart.
         * @param {string} [labelX=none] Configure a specific label for the X axis. By default it is named after the field used for the X axis.
         * @param {string} [labelY=none] Configure a specific label for the charted values and the Y axis. By default it is named after the expression used for the Y axis, or 'Count' if `functionY` is "COUNT".
         * @param {string|Object} [chartConfig=none] a complete configuration, as a object or as a base64 string. The parameter directly expects an angular expression, so a base64 string needs to be quoted. If this parameter is present, all the other parameters are ignored, and the chart will not change if the context changes.
         *
         * @description
         * This widget can be used to integrate a visualization based on Highcharts.
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-dataset-context context="hurricanes" hurricanes-domain="public.opendatasoft.com" hurricanes-dataset="hurricane-tracks-1851-20071">
         *              <ods-highcharts context="hurricanes" field-x="track_date" chart-type="line" timescale="year" function-y="COUNT"></ods-highcharts>
         *          </ods-dataset-context>
         *      </file>
         *  </example>
         */
        var defaultColors = colorScale.getColors(colorScale.getDefaultColorSet());

        return {
            restrict: 'E',
            scope: {
                context: '=',
                fieldX: '@',
                expressionY: '@',
                functionY: '@',
                timescale: '@',
                chartType: '@',
                color: '@',
                chartConfig: '=',
                labelX: '@',
                labelY: '@',
                sort: '@',
                maxpoints: '@'
            },
            replace: true,
            template: '<div class="odswidget odswidget-highcharts"><div ods-highcharts-chart parameters="chart" domain="context.domain" apikey="context.apikey"></div></div>',
            controller: ['$scope', 'ODSWidgetsConfig', 'ChartHelper', function($scope, ODSWidgetsConfig, ChartHelper) {

                var colors = ODSWidgetsConfig.chartColors || defaultColors;
                if ($scope.color) {
                    colors = $scope.color.split(',').map(function(item) { return item.trim(); });
                }

                var unwatch = $scope.$watch('context.dataset', function(nv) {
                    if (nv) {
                        if ($scope.context.type !== 'dataset') {
                            console.error('ods-highcharts requires a Dataset Context');
                        }

                        ChartHelper.init($scope.context);
                        if (angular.isUndefined($scope.chartConfig)) {
                            var extras = {};
                            if ($scope.chartType === 'pie') {
                                extras = {'colors': colors};
                            }
                            // Sort: x, -x, y, -y
                            var sort = '';
                            if ($scope.sort === 'y') {
                                sort = 'serie1-1';
                            } else if ($scope.sort === '-y') {
                                sort = '-serie1-1';
                            } else {
                                sort = $scope.sort;
                            }
                            // TODO: Retrieve the field label for default X and Y labels (using ODS.Dataset coming soon)
                            var yLabel = $scope.labelY || ($scope.functionY.toUpperCase() === 'COUNT' ? 'Count' : $scope.expressionY);
                            $scope.chart = {
                                timescale: $scope.timescale,
                                xLabel: $scope.labelX,
                                queries : [
                                    {
                                        config: {
                                            dataset: $scope.context.dataset.datasetid,
                                            options: $scope.context.parameters,
                                            domain: $scope.context.domain
                                        },
                                        xAxis: $scope.fieldX,
                                        sort: sort,
                                        maxpoints: $scope.maxpoints || 50,
                                        charts: [
                                            {
                                                yAxis: $scope.expressionY,
                                                yLabelOverride: yLabel,
                                                func: $scope.functionY,
                                                color: colors[0],
                                                type: $scope.chartType,
                                                extras: extras
                                            }
                                        ]
                                    }
                                ]
                            };
                        } else {
                            if (angular.isString($scope.chartConfig)) {
                                $scope.chart = JSON.parse(b64_to_utf8($scope.chartConfig));
                            } else {
                                $scope.chart = angular.copy($scope.chartConfig);
                            }
                        }
                        $scope.$broadcast('chartConfigReady', $scope.chart); //FIXME: broadcasts still used?

                        $scope.$watch('chart', function(nv) {
                            var i, j;
                            if (nv) {
                                var uniqueid = ChartHelper.getDatasetId($scope.context);

                                for (i = 0; i < nv.queries.length; i++) {
                                    var query = nv.queries[i];
                                    if (typeof query.xAxis === "undefined") {
                                        ChartHelper.setDefaultQueryValues(uniqueid, query, true);
                                    }

                                    for (j = 0; j < query.charts.length; j++) {
                                        ChartHelper.setSerieDefaultValues(uniqueid, query.charts[j], query.xAxis, true);
                                    }

                                    ChartHelper.setDefaultQueryValues(uniqueid, query, true);

                                    if ($scope.chart.queries.length === 1) {
                                        ChartHelper.setChartDefaultValues(uniqueid, nv, true);
                                    }

                                    for (j = 0; j < query.charts.length; j++) {
                                        ChartHelper.setSerieDefaultColors(query.charts[j], query.seriesBreakdown);
                                    }
                                }

                                $scope.$broadcast('chartConfigReady', $scope.chart);
                            }
                        }, true);

                        unwatch();
                    }
                });
            }]
        };
    }]);

    mod.directive('odsMultiHighcharts', ["ODSAPI", 'ChartHelper', '$q', function(ODSAPI, ChartHelper, $q) {
        /**
         * @deprecated
         * @ngdoc directive
         * @name ods-widgets.directive:odsMultiHighcharts
         * @restrict E
         * @scope
         * @param {CatalogContext} context {@link ods-widgets.directive:odsCatalogContext Catalog Context} to use
         * @param {string|Object} [chartConfig=none] A complete configuration, as a object or as a base64 string. The parameter directly expects an angular expression, so a base64 string needs to be quoted.
         * @description
         * This widget can display a multiple chart generated using the "Charts" interface of OpenDataSoft.
         *
         */
        return {
            restrict: 'E',
            scope: {
                context: '=',
                chartConfig: '='
            },
            replace: true,
            template: '<div class="odswidget odswidget-multihighcharts"><div ods-chart parameters="chart" domain="context.domain" apikey="context.apikey"></div></div>',
            controller: ['$scope', function($scope) {
                var unwatch = $scope.$watch('context', function(nv) {
                    var i;
                    if (!nv) return;
                    if (nv.type !== 'catalog') {
                        console.error('ods-multi-highcharts requires a Catalog Context');
                    }
                    var chartConfig;
                    if (angular.isString($scope.chartConfig)) {
                        chartConfig = JSON.parse(b64_to_utf8($scope.chartConfig));
                    } else {
                        chartConfig = $scope.chartConfig;
                    }

                    var datasets = [];
                    for (i = 0; i < chartConfig.queries.length; i++) {
                        var datasetid = chartConfig.queries[i].config.dataset;
                        if (datasets.indexOf(datasetid) === -1) {
                            datasets.push(datasetid);
                        }
                    }
                    var requests = [];
                    var success = function(data) {
                        var dataset = new ODS.Dataset(data);
                        // dataset.metas.domain = $scope.context.domain;
                        $scope.context.dataset = dataset;
                        ChartHelper.init($scope.context);
                    };
                    for (i = 0; i < datasets.length; i++) {
                        requests.push(ODSAPI.datasets.get($scope.context, datasets[i], {extrametas: true}).
                            success(success));
                    }
                    $q.all(requests).then(function(arg) {
                        $scope.chart = chartConfig;
                        // $scope.$broadcast('chartConfigReady', $scope.chart);
                    });
                    unwatch();
                });
            }]
        };
    }]);




    mod.directive('odsChart', ["ODSAPI", 'ChartHelper', 'ODSWidgetsConfig', function(ODSAPI, ChartHelper, ODSWidgetsConfig) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsChart
         * @restrict E
         * @scope
         * @param {string} [timescale=none] Works only with timeseries. If defines the default timescale to use to display the X Axis. It does not affect the way the different series are requested (they have there own timescale) but enforces X axis intervals.
         * @param {string} [labelX=none] If set, it override the default X Axis label. The default label is generated from series.
         * @param {boolean} [singleYAxis=false] Enforces the use of only one Y axis for all series. In this case, specific Y axis parameters defined for each series will be ignored.
         * @param {string} singleYAxisLabel Set the label for the single Y axis.
         * @param {integer} min Set the min displayed value for Y axis
         * @param {integer} max Set the max displayed value for Y axis
         * @param {boolean} logarithmic Use a logarithmic scale for Y axis
         * @param {boolean} [displayLegend=true] enable or disable the display of series legend
         *
         * @description
         * This widget is the base widget allowing to display charts from OpenDataSoft datasets.
         * A Chart is defined by one or more series that get there data from form one or more dataset represented by an {@link ods-widgets.directive:odsDatasetContext Dataset Context},
         * a type of chart and multiple parameters to fine tune the appearance of chart.
         *
         * Basic example:
         *    <pre>
         *        <ods-dataset-context hurricanetracks185120071-parameters="{}" hurricanetracks185120071-dataset="hurricane-tracks-1851-20071" context="hurricanetracks185120071">
         *            <ods-chart timescale="year">
         *                <ods-chart-query context="hurricanetracks185120071" field-x="track_date" timescale="year">
         *                    <ods-chart-serie expression-y="pressure" chart-type="line" function-y="AVG" color="#66c2a5"></ods-chart-serie>
         *                </ods-chart-query>
         *            </ods-chart>
         *        </ods-dataset-context>
         *    </pre>
         *
         * You can display multiple series from the same dataset on the same chart:
         *    <pre>
         *        <ods-dataset-context hurricanetracks185120071-parameters="{}" hurricanetracks185120071-dataset="hurricane-tracks-1851-20071" context="hurricanetracks185120071">
         *          <ods-chart timescale="year">
         *                <ods-chart-query context="hurricanetracks185120071" field-x="track_date" timescale="year">
         *                    <ods-chart-serie expression-y="pressure" chart-type="line" function-y="AVG" color="#66c2a5"></ods-chart-serie>
         *                    <ods-chart-serie expression-y="wind_kts" chart-type="line" function-y="AVG" color="#fc8d62"></ods-chart-serie>
         *                </ods-chart-query>
         *            </ods-chart>
         *        </ods-dataset-context>
         *    </pre>
         *
         * You can display multiple series from multiple datasets on the same chart:
         *    <pre>
         *        <ods-dataset-context hurricanetracks185120071-parameters="{}" hurricanetracks185120071-dataset="hurricane-tracks-1851-20071" thedeadliesthurricanesintheunitedstates19001996-parameters="{}" thedeadliesthurricanesintheunitedstates19001996-dataset="the-deadliest-hurricanes-in-the-united-states-1900-1996" context="hurricanetracks185120071,thedeadliesthurricanesintheunitedstates19001996">
         *            <ods-chart timescale="year">
         *                <ods-chart-query context="hurricanetracks185120071" field-x="track_date" timescale="year">
         *                    <ods-chart-serie expression-y="wind_kts" chart-type="line" function-y="MAX" color="#66c2a5">
         *                    </ods-chart-serie>
         *                </ods-chart-query>
         *                <ods-chart-query context="thedeadliesthurricanesintheunitedstates19001996" field-x="year" timescale="year">
         *                    <ods-chart-serie expression-y="deaths" chart-type="column" function-y="AVG" color="#fc8d62">
         *                    </ods-chart-serie>
         *                </ods-chart-query>
         *            </ods-chart>
         *        </ods-dataset-context>
         *    </pre>
         */
        return {
            restrict: 'EA',
            scope: {
                timescale: '@',
                labelX: '@',
                singleYAxis: '@',
                singleYAxisLabel: '@',
                singleYAxisScale: '@',
                min: '@',
                max: '@',
                logarithmic: '@',
                displayLegend: '@',

                // old syntax can still be used for simple chart
                context: '=?',
                fieldX: '@',
                expressionY: '@',
                functionY: '@',
                chartType: '@',
                color: '@',
                chartConfig: '=?',
                labelY: '@',
                sort: '@',
                maxpoints: '@',

                chart: '=?parameters'
            },
            replace: true,
            transclude: true,
            template: '<div class="odswidget odswidget-charts">' +
                '<debug data="chart"></debug>' +
                '<div ods-highcharts-chart parameters="chart" domain="context.domain" apikey="context.apikey" contexts="contexts"></div>' +
                '<div ng-transclude></div>' +
            '</div>',
            controller: ['$scope', '$element', '$attrs', '$transclude', function($scope, $element, $attrs, $transclude) {
                $scope.contexts = [];
                this.pushContext = function(context) {
                    $scope.contexts.push(context);
                };
                if (!$scope.chart) {
                    $scope.chart = {
                        queries: [],
                        xLabel: angular.isDefined($scope.labelX) ? $scope.labelX : undefined,
                        timescale: $scope.timescale || "",
                        singleAxis: !!$scope.singleYAxis,
                        singleAxisLabel: angular.isDefined($scope.singleYAxisLabel) ? $scope.singleYAxisLabel : undefined,
                        singleAxisScale: $scope.logarithmic ? 'logarithmic' : '',
                        yRangeMin: angular.isDefined($scope.min) && $scope.min !== "" ? parseInt($scope.min, 10) : undefined,
                        yRangeMax: angular.isDefined($scope.max) && $scope.max !== "" ? parseInt($scope.max, 10) : undefined,
                        displayLegend: angular.isDefined($scope.displayLegend) && $scope.displayLegend === "false" ? false : true
                    };
                }

                angular.forEach($scope.chart, function(item, key) {
                    if (typeof item === "undefined") {
                        delete $scope.chart[key];
                    }
                });

                if ($attrs.context) {
                    // backward compatibility
                    (function() {
                        var colors = ODSWidgetsConfig.chartColors || defaultColors;
                        if ($scope.color) {
                            colors = $scope.color.split(',').map(function(item) { return item.trim(); });
                        }

                        var unwatch = $scope.$watch('context.dataset', function(nv) {
                            if (nv) {
                                if ($scope.context.type !== 'dataset') {
                                    console.error('ods-chart requires a Dataset Context');
                                }

                                ChartHelper.init($scope.context);
                                if (angular.isUndefined($scope.chartConfig)) {
                                    var extras = {};
                                    if ($scope.chartType === 'pie') {
                                        extras = {'colors': colors};
                                    }
                                    // Sort: x, -x, y, -y
                                    var sort = '';
                                    if ($scope.sort === 'y') {
                                        sort = 'serie1-1';
                                    } else if ($scope.sort === '-y') {
                                        sort = '-serie1-1';
                                    } else {
                                        sort = $scope.sort;
                                    }
                                    // TODO: Retrieve the field label for default X and Y labels (using ODS.Dataset coming soon)
                                    var yLabel = $scope.labelY || ($scope.functionY.toUpperCase() === 'COUNT' ? 'Count' : $scope.expressionY);
                                    $scope.chart = {
                                        timescale: $scope.timescale,
                                        xLabel: $scope.labelX,
                                        queries: [
                                            {
                                                config: {
                                                    dataset: $scope.context.dataset.datasetid,
                                                    options: $scope.context.parameters
                                                },
                                                xAxis: $scope.fieldX,
                                                sort: sort,
                                                maxpoints: $scope.maxpoints || 50,
                                                charts: [
                                                    {
                                                        yAxis: $scope.expressionY,
                                                        yLabelOverride: yLabel,
                                                        func: $scope.functionY,
                                                        color: colors[0],
                                                        type: $scope.chartType,
                                                        extras: extras
                                                    }
                                                ]
                                            }
                                        ]
                                    };
                                } else {
                                    if (angular.isString($scope.chartConfig)) {
                                        $scope.chart = JSON.parse(b64_to_utf8($scope.chartConfig));
                                    } else {
                                        $scope.chart = $scope.chartConfig;
                                    }
                                }
                                unwatch();
                            }
                        });
                    })();
                    this.setQuery = function(query, context) {
                        console.error("cannot use ods-chart-query when context and chartConfig are declared on ods-chart");
                    };
                } else {
                    this.setQuery = function(query, context) {
                        var index = $scope.chart.queries.indexOf(query);
                        var groups, j;
                        if (index === -1) {
                            index = $scope.chart.queries.length;
                            $scope.chart.queries.push(query);
                        } else {
                            $scope.chart.queries[index] = query;
                        }

                        if (query.sort) {
                            groups = query.sort.match(/^(-?)serie([0-9]+)$/);
                            if (groups) {
                                $scope.chart.queries[index].sort = groups[1] + 'serie' + (index + 1) + '-' + groups[2];
                            }
                        }
                        // copy the used context to the current $scope
                        var contextInArray = false;
                        for (var contextIndex = 0; contextIndex < $scope.contexts.length; contextIndex++) {
                            if ($scope.contexts[contextIndex].name === context.name) {
                                contextInArray = true;
                            }
                        }
                        if (!contextInArray) {
                            $scope.contexts.push(context);
                        }
                        // make sure everything is correctly set before displying it:
                        var uniqueid = ChartHelper.getDatasetId(context);

                        if (typeof query.xAxis === "undefined") {
                            ChartHelper.setDefaultQueryValues(uniqueid, query, true);
                        }

                        for (j = 0; j < query.charts.length; j++) {
                            ChartHelper.setSerieDefaultValues(uniqueid, query.charts[j], query.xAxis, true);
                        }

                        ChartHelper.setDefaultQueryValues(uniqueid, query, true);

                        if ($scope.chart.queries.length === 1) {
                            ChartHelper.setChartDefaultValues(uniqueid, $scope.chart, true);
                        }

                        for (j = 0; j < query.charts.length; j++) {
                            ChartHelper.setSerieDefaultColors(query.charts[j], query.seriesBreakdown);
                        }
                    };

                    $scope.$watch('labelX', function(nv, ov) {
                        $scope.chart.xLabel = nv;
                    });
                }
            }]
        };
    }]);


    mod.directive('odsChartQuery', ["ODSAPI", 'ChartHelper',function(ODSAPI, ChartHelper) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsChartQuery
         * @restrict E
         * @scope
         * @param {string} fieldX Set the field that is used to compute the aggregations during the analysis query.
         * @param {string} [timescale="year"] Works only with timeseries (when fieldX is a date or datetime). Y values will be computed against this interval. For example, if you have daily values in a dataset and ask for a "month" timescale, the Y values for the {@link ods-widgets.directive:odsChartSerie series} inside this query will aggregated month by month and computed.
         * @param {integer} [maxpoints=0] Defines the maximum number of points fetched by the query.
         * @param {boolean} [stacked=false] Stack the resulting charts. Only works with columns, line charts and area charts.
         * @param {string} [seriesBreakdown=none] When declared, all series are break down by the defined facet
         * @param {string} [seriesBreakdownTimescale=true] if the break down facet is a time serie (date or datetime), it defines the aggregation level for this facet
         *
         * @description
         * odsChartQuery is the sub widget that defines the queries for the series defined inside.
         * see {@link ods-widgets.directive:odsChart odsChart} for complete examples.
         */
        return {
            restrict: 'E',
            require: ["odsChartQuery", "^odsChart"],
            controller: ['$scope', function($scope) {
            }],
            compile: function() {
                return {
                    pre: function(scope, element, attrs, ctrls) {
                        var thisController = ctrls[0],
                            odsChartController = ctrls[1];
                        var query = {
                            config: {},
                            charts: [],
                            xAxis: attrs.fieldX,
                            maxpoints: attrs.maxpoints ? parseInt(attrs.maxpoints, 10): undefined,
                            timescale: attrs.timescale,
                            stacked: attrs.stacked,
                            seriesBreakdown: attrs.seriesBreakdown,
                            seriesBreakdownTimescale: attrs.seriesBreakdownTimescale
                        };

                        query.sort = '';
                        if (attrs.sort === 'y') {
                            query.sort = 'serie1';
                        } else if (attrs.sort === '-y') {
                            query.sort = '-serie1';
                        } else {
                            query.sort = attrs.sort;
                        }
                        var forcedOptions = attrs.options || {};

                        angular.forEach(query, function(item, key) {
                            if (typeof item === "undefined") {
                                delete query[key];
                            }
                        });

                        thisController.setChart = function(chart) {
                            if (query.charts.indexOf(chart) === -1) {
                                query.charts.push(chart);
                            }
                        };
                        var pushQuery = function(context) {
                            if (context) {
                                odsChartController.setQuery(query, context);
                            }
                        };

                        thisController.pushContext = function(context) {
                            odsChartController.pushContext(context);
                        };

                        var context = attrs.context;
                        scope[context].wait().then(function(dataset) {
                            ChartHelper.init(scope[context]);
                            query.config.dataset = dataset.datasetid;
                            query.config.domain = scope[context].domain;
                            query.config.apikey = scope[context].apikey;
                            query.config.options = angular.extend({}, scope[context].parameters, forcedOptions);

                            thisController.setChart = function(chart) {
                                if (query.charts.indexOf(chart) === -1) {
                                    query.charts.push(chart);
                                }
                                pushQuery(scope[context]);
                            };

                            pushQuery(scope[context]);

                            scope.$watch(context + ".parameters", function(nv, ov) {
                                if (nv) {
                                    query.config.options = angular.extend({}, nv, forcedOptions);
                                    pushQuery(scope[context]);
                                }
                            }, true);
                        });
                    }
                };
            }
        };
    }]);

    mod.directive('odsChartSerie', ["ODSAPI", 'ChartHelper', '$compile', '$parse', function(ODSAPI, ChartHelper, $compile, $parse) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsChartSerie
         * @restrict E
         * @scope
         * @param {string} [chartType] available types are: 'line', 'spline', 'arearange', 'areasplinerange', 'columnrange', 'area', 'areaspline', 'column', 'bar', 'pie', 'scatter'
         * @param {string} [functionY] set up the function that will be used to calculate aggreation value. 'COUNT' counts the number of documents for each category defined by expressionY.
         * @param {string} [expressionY] set up the facet used for aggregation
         * @param {string} [color] defines the color used for this serie. see colors below
         * @param {string} [labelY] specify a custom label for the serie
         * @param {boolean} [cumulative] Y values are accumulated
         * @param {boolean} [logarithmic] display the serie using a logarithmic scale
         * @param {integer} [min] minimum value to be displayed on the Y axis
         * @param {integer} [max] maximum value to be displayed on the Y axis
         * @param {boolean} [displayUnits] enable the display of the units defined for the field in the tooltip
         * @param {boolean} [displayValues] enable the display of each invidual values in stacks
         * @param {boolean} [displayStackValues] enable the display of the cumulated values on top of stacks
         * @param {number} [multiplier] multiply all values for this serie by the defined number
         * @param {string} [colorThresholds] an array of (value, color) objects. For each threshold value, if the Y value is above the threshold, the defined color is used. The format for this parameter is color-thresholds="[{'value': 5, 'color': '#00ff00'},{'value': 10, 'color': '#ffff00'}]"
         * @param {string} [subsets] used when functionY is set to 'QUANTILES' to define the wanted quantile
         * @param {boolean} [subseries] an array containing 2 objects. TODO add explanation for this...
         * @param {string} [refineOnClickContext] context name or array of of contexts name on which to refine when the serie is clicked on.
         * @param {string} [refineOnClick[context]ContextField] name of the field that will be refined for each context.
         *
         * @description
         * odsChartSerie is the sub widget that defines a serie in the chart with all its parameters.
         * see {@link ods-widgets.directive:odsChart odsChart} for complete examples.
         * # Available chart types:
         * There are three available types of charts: simple series and areas that takes a minimal and a maximal value.
         * ## simple series
         * - line
         * - spline
         * - area
         * - areaspline
         * - column
         * - bar
         * - pie
         * - scatter
         * ## areas
         * - arearange
         * - areasplinerange
         * - columnrange
         * # available functions
         * - COUNT
         * - AVG
         * - MIN
         * - MAX
         * - STDDEV
         * - SUM
         * - QUANTILES
         * - CONSTANT
         */
        return {
            restrict: 'E',
            require: ["^odsChartQuery", "?refineOnClick", "?refineOnClickContext"],
            controller: ['$scope', '$transclude', function($scope, $transclude) {
            }],
            link: function(scope, element, attrs, ctrls) {
                var odsChartQueryController = ctrls[0],
                    refineOnClickCtrl = ctrls[1] || ctrls[2];

                var chart = {
                    type: attrs.chartType || undefined,
                    innersize: attrs.innersize || undefined,
                    labelsposition: attrs.labelsposition || undefined,
                    func: attrs.functionY || undefined,
                    yAxis: attrs.expressionY || undefined,
                    color: attrs.color || undefined,
                    cumulative: !!attrs.cumulative || false,
                    yLabelOverride: angular.isDefined(attrs.labelY) ? attrs.labelY : undefined,
                    scale: attrs.logarithmic ? 'logarithmic' : '',
                    yRangeMin: angular.isDefined(attrs.min) && attrs.min !== "" ? parseInt(attrs.min, 10) : undefined,
                    yRangeMax: angular.isDefined(attrs.max) && attrs.max !== "" ? parseInt(attrs.max, 10) : undefined,
                    displayUnits: attrs.displayUnits === "true",
                    displayValues: attrs.displayValues === "true",
                    displayStackValues: attrs.displayStackValues === "true",
                    multiplier: angular.isDefined(attrs.multiplier) ? parseInt(attrs.multiplier, 10) : undefined,
                    thresholds: attrs.colorThresholds ? scope.$eval(attrs.colorThresholds) : [],
                    subsets: attrs.subsets,
                    charts: attrs.subseries ? JSON.parse(attrs.subseries) : undefined,
                    refineOnClickCtrl: refineOnClickCtrl
                };

                angular.forEach(chart, function(item, key) {
                    if (typeof item === "undefined") {
                        delete chart[key];
                    }
                });
                odsChartQueryController.setChart(chart);
                attrs.$observe('labelY', function(value) {
                    chart.yLabelOverride = value;
                    odsChartQueryController.setChart(chart);
                });
            }
        };
    }]);


}());
;(function () {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsHubspotForm', function () {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsHubspotForm
         * @restrict E
         * @scope
         * @param {string} portalId The portal ID
         * @param {string} formId The form ID
         * @description
         * Integrates a Hubspot form given a portal ID and the form ID.
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-hubspot-form portal-id="1234567" form-id="d1234564-987987987-4564654-7897-456465465"></ods-hubspot-form>
         *      </file>
         *  </example>
         */
        return {
            restrict: 'E',
            replace: true,
            template: '<div class="odswidget odswidget-hubspot-form"></div>',
            scope: {
                'portalId': '@',
                'formId': '@'
            },
            link: function(scope, element, attrs) {
                LazyLoad.js('//js.hsforms.net/forms/v2.js', function() {
                    hbspt.forms.create({ portalId: attrs.portalId ,formId: attrs.formId, target:'.odswidget-hubspot-form' });
                });
            }
        };
    });
}());;(function() {
    "use strict";

    var mod = angular.module('ods-widgets');

    mod.directive('odsInfiniteScrollResults', function() {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsInfiniteScrollResults
         * @scope
         * @restrict A
         * @param {CatalogContext|DatasetContext} odsResultsContext {@link ods-widgets.directive:odsCatalogContext Catalog Context} or {@link ods-widgets.directive:odsDatasetContext Dataset Context} to use
         * @param {boolean} [scrollTopWhenRefresh=false] If the context parameters change (which will probably change the results), scroll to the top of the window.
         * @param {string} [listClass=none] A class (or classes) that will be applied to the list of result.
         * @param {string} [resultClass=none] A class (or classes) that will be applied to each result.
         * @param {string} [noResultsMessage] A sentence that will be displayed if there are no results.
         * @param {string} [noMoreResultsMessage] A sentence that will be displayed if there are no more results to fetch.
         * @param {string} [noDataMessage] A sentence that will be displayed if the context has no content at all.
         * @description
         * This widget displays the results of a query inside an infinite scroll list. It uses the HTML template inside the widget tag,
         * and repeats it for each result.
         *
         * If used with a {@link ods-widgets.directive:odsCatalogContext Catalog Context}, for each result, the following AngularJS variables are available:
         *
         *  * item.datasetid: Dataset identifier of the dataset
         *  * item.metas: An object holding the key/values of metadata for this dataset
         *
         * If used with a {@link ods-widgets.directive:odsDatasetContext Dataset Context}, for each result, the following AngularJS variables are available:
         *
         *  * item.datasetid: Dataset identifier of the dataset this record belongs to
         *  * item.fields: an object hold all the key/values for the record
         *  * item.geometry: if the record contains geometrical information, this object is present and holds its GeoJSON representation
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-catalog-context context="public" public-domain="public.opendatasoft.com">
         *              <ul>
         *                  <ods-infinite-scroll-results context="public">
         *                      <li>
         *                          <strong>{{item.metas.title}}</strong>
         *                          (<a ng-href="{{context.domainUrl + '/explore/dataset/' + item.datasetid + '/'}}" target="_blank">{{item.datasetid}}</a>)
         *                      </li>
         *                  </ods-infinite-scroll-results>
         *              </ul>
         *          </ods-catalog-context>
         *      </file>
         *  </example>
         */
        return {
            template: '' +
                '<div class="{{listClass}} odswidget-infinite-scroll-results" infinite-scroll="loadMore()" infinite-scroll-distance="2" infinite-scroll-disabled="fetching">' +
                '   <div class="{{resultClass}}" ng-repeat="item in results" inject>' +
                '   </div>' +
                '   <div class="odswidget-infinite-scroll-results__message-container">' +
                '       <ods-spinner class="odswidget-infinite-scroll-results__spinner" ng-if="fetching"></ods-spinner>'+
                '       <div class="odswidget-infinite-scroll-results__no-more-results-message" ng-if="!fetching && results.length > 0">{{ noMoreResultsMessage }}</div>'+
                '       <div class="odswidget-infinite-scroll-results__no-results-message ng-cloak" ng-if="!fetching && results.length == 0 && context.getActiveFilters().length > 0"">{{ noResultsMessage }}</div>' +
                '       <div class="odswidget-infinite-scroll-results__no-results-message ng-cloak" ng-if="!fetching && results.length == 0 && context.getActiveFilters().length == 0" ng-bind-html="noDataMessage"></div>' +
                '   </div>' +
                '</div>',
            scope: {
                context: '=',
                resultClass: '@',
                listClass: '@',
                noMoreResultsMessage: '@',
                noResultsMessage: '@',
                noDataMessage: '@',
                scrollTopWhenRefresh: '='
            },
            transclude: true,
            controller: ['$scope', '$window', 'ODSAPI', function($scope, $window, ODSAPI) {
                var page = 0;
                var noMoreResults = false;
                $scope.fetching = false;
                $scope.results = [];
                var fetchResults = function(init) {
                    if (noMoreResults) {
                        return;
                    }
                    if (init) {
                        page = 0;
                    } else {
                        page += 1;
                    }
                    var start = page * 10;
                    var func;

                    $scope.fetching = true;
                    if ($scope.context.type == 'catalog') {
                        // FIXME: the extrametas parameter has been added here because the only place we use this directive
                        // requires it, but we may be able to find something less "hardcoded".
                        ODSAPI.datasets.search($scope.context, {rows: 10, start: start, extrametas: true}).success(function(data) {
                            noMoreResults = data.datasets.length == 0;
                            renderResults(data.datasets, init);
                        });
                    } else {
                        ODSAPI.records.search($scope.context, {rows: 10, start: start}).success(function(data) {
                            noMoreResults = data.records.length == 0;
                            renderResults(data.records, init);
                        });
                    }
                };

                var renderResults = function(results, init) {
                    if (init) {
                        $scope.results = [];
                    }
                    $scope.results = $scope.results.concat(results);
                    $scope.fetching = false;
                    if (init && $scope.scrollTopWhenRefresh) {
                        $window.scrollTo($window.scrollX, 0);
                    }
                };

                $scope.loadMore = function() {
                    fetchResults(false);
                };

                $scope.$watch('context.parameters', function(nv, ov) {
                    if (nv !== ov) {
                        noMoreResults = false;
                        fetchResults(true);
                    }
                }, true);

                if ($scope.context.type === 'dataset') {
                    $scope.context.wait().then(function() {
                        fetchResults(true);
                    });
                } else {
                    fetchResults(true);
                }
            }]
        };
    });
}());;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsLastDatasetsFeed', ['ODSAPI', function(ODSAPI) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsLastDatasetsFeed
         * @scope
         * @restrict E
         * @param {CatalogContext} context {@link ods-widgets.directive:odsCatalogContext Catalog Context} to use
         * @description
         * This widget displays the last 5 datasets of a catalog, based on the *modified* metadata.
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-catalog-context context="public" public-domain="public.opendatasoft.com">
         *              <ods-last-datasets-feed context="public"></ods-last-datasets-feed>
         *          </ods-catalog-context>
         *      </file>
         *  </example>
         */
        return {
            restrict: 'E',
            replace: true,
            template: '<div class="odswidget odswidget-last-datasets-feed">' +
                '<ul class="odswidget-last-datasets-feed__datasets">' +
                '   <li class="no-data" ng-hide="datasets" translate>No data available yet</li>' +
                '   <li class="odswidget-last-datasets-feed__dataset" ng-repeat="dataset in datasets" ng-if="datasets">' +
                '       <ods-theme-picto class="odswidget-last-datasets-feed__theme-picto" theme="{{dataset.metas.theme|firstValue}}"></ods-theme-picto>' +
                '       <div class="odswidget-last-datasets-feed__dataset-details">' +
                '           <div class="odswidget-last-datasets-feed__dataset-details-title"><a ng-href="{{context.domainUrl}}/explore/dataset/{{dataset.datasetid}}/" target="_self">{{ dataset.metas.title }}</a></div>' +
                '           <div class="odswidget-last-datasets-feed__dataset-details-modified"><i class="fa fa-calendar"></i> <span title="{{ dataset.metas.modified|moment:\'LLL\' }}"><span translate>Modified</span> {{ dataset.metas.modified|timesince }}</span></div>' +
                '       </div>' +
                '   </li>' +
                '</ul>' +
                '</div>',
            scope: {
                context: '='
            },
            controller: ['$scope', function($scope) {
                var refresh = function() {
                    ODSAPI.datasets.search($scope.context, {'rows': 5, 'sort': 'modified'}).
                        success(function(data) {
                            $scope.datasets = data.datasets;
                        });
                };
                $scope.$watch('context', function() {
                    refresh();
                });
            }]
        };
    }]);

}());;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsLastReusesFeed', ['ODSAPI', function(ODSAPI) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsLastReusesFeed
         * @scope
         * @restrict E
         * @param {CatalogContext} context {@link ods-widgets.directive:odsCatalogContext Catalog Context} to use
         * @param {number} [max=5] Maximum number of reuses to show
         * @description
         * This widget displays the last 5 reuses published on a domain.
         *
         * It is possible to customize the template used to display each reuse, by adding HTML inside the widget's tag.
         * The following variables are available:
         *
         * * reuse.url: URL to the reuse's dataset page
         * * reuse.title: Title of the reuse
         * * reuse.thumbnail: URL to the thumbnail of the reuse
         * * reuse.description: Description of the reuse
         * * reuse.created_at: ISO datetime of reuse's original submission (can be used as `reuse.created_at|moment:'LLL'` to format it)
         * * reuse.dataset.title: Title of the reuse's dataset
         * * reuse.user.last_name: Last name of the reuse's submitter
         * * reuse.user.first_name: First name of the reuse's submitter
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-catalog-context context="paris" paris-domain="http://opendata.paris.fr">
         *              <ods-last-reuses-feed context="paris"></ods-last-reuses-feed>
         *          </ods-catalog-context>
         *      </file>
         *  </example>
         */
        return {
            restrict: 'E',
            replace: true,
            transclude: true,
            template: '<div class="odswidget odswidget-last-reuses-feed">' +
                '<ul class="odswidget-last-reuses-feed__reuses">' +
                '   <li class="no-data" ng-hide="reuses" translate>No data available yet</li>' +
                '   <li class="odswidget-last-reuses-feed__reuse" ng-repeat="reuse in reuses" ng-if="reuses" inject>' +
                '       <div class="odswidget-last-reuses-feed__reuse-thumbnail">' +
                '           <span style="display: inline-block; height: 100%; vertical-align: middle;"></span>' +
                '           <a ng-href="{{reuse.url}}" target="_self"><img class="odswidget-last-reuses-feed__reuse-thumbnail-image" ng-if="reuse.thumbnail" ng-src="{{ reuse.thumbnail }}"></a>' +
                '       </div>' +
                '       <div class="odswidget-last-reuses-feed__reuse-details">' +
                '           <div class="odswidget-last-reuses-feed__reuse-details-title"><a ng-href="{{reuse.url}}" target="_self">{{ reuse.title }}</a></div>' +
                '           <div class="odswidget-last-reuses-feed__reuse-details-dataset"><a ng-href="{{reuse.url}}" target="_self">{{ reuse.dataset.title }}</a></div>' +
                '           <div class="odswidget-last-reuses-feed__reuse-details-modified"><span title="{{ reuse.created_at|moment:\'LLL\' }}"><i class="fa fa-calendar"></i> {{ reuse.created_at|timesince }}</span></div>' +
                '       </div>' +
                '   </li>' +
                '</ul>' +
                '</div>',
            scope: {
                context: '=',
                max: '@'
            },
            controller: ['$scope', function($scope) {
                $scope.max = $scope.max || 5;
                var refresh = function() {
                    // TODO: If the context is a dataset-context
                    ODSAPI.reuses($scope.context, {'rows': $scope.max}).
                        success(function(data) {
                            angular.forEach(data.reuses, function(reuse) {
                                reuse.url = $scope.context.domainUrl + '/explore/dataset/' + reuse.dataset.id + '/?tab=metas';
                            });
                            $scope.reuses = data.reuses;
                        });
                };
                $scope.$watch('context', function() {
                    refresh();
                });
            }]
        };
    }]);

}());;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsMapLegacy', ['ModuleLazyLoader', function(ModuleLazyLoader) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsMapLegacy
         * @restrict E
         * @scope
         * @param {DatasetContext} context {@link ods-widgets.directive:odsDatasetContext Dataset Context} to use
         * @param {boolean} [autoResize=false] If true, the map will attempt to resize itself to always take up all the space to the bottom of the viewport.
         * It is only useful in very specific cases, when the map is the main focus of the page and should take all the window real estate available.
         * @param {string} [location=none] Initial location of the map, under the format "zoom,latitude,longitude" (e.g. *12,48.85887,2.3292*)
         * @param {string} [basemap=default basemap] Identifier of the basemap to apply. Basemaps are configured using {@link ods-widgets.ODSWidgetsConfigProvider ODSWidgetsConfig.basemaps}.
         * @param {boolean} [isStatic=false] If true, the map can't be panned or zoomed; in other words the map is static and can only show the initial view. Interaction with the data is still active,
         * for example you can still click on a marker to have a tooltip.
         * @param {boolean} [showFilters=false] If true, displays additional tools to use the map to filter the data in the context. For example if you use a table and a map on the same context,
         * this makes you able to use the map to refine the data displayed in the table.
         * @param {Object} [mapContext=none] An object that you can use to share the map state (location and basemap) between two or more map widgets when they are not in the same context.
         * @param {DatasetContext} [itemClickContext=none] Instead of popping a tooltip when you click on an item on the map, you can decide to add a filter to another context using this parameter.
         * Clicks that would normally make a popup appear (markers, clusters that can't be expanded more, shapes) will instead filter the specified context.
         *
         * By default this is a spatial filter:
         * if you clicked a point, then the filter is the exact location; if you clicked a shape, then the filter is the content of this shape.
         *
         * Note that you can specify more than one context by passing an array:
         * <pre>
         *     <ods-map-legacy context="myctx"
         *              item-click-context="[context2, context3]">
         *     </ods-map-legacy>
         * </pre>
         * In that case, the `itemClickMapField` and `itemClickContextField` (as described below) need to contain the name of the context they apply to:
         * <pre>
         *     <ods-map-legacy context="myctx"
         *              item-click-context="[trees, roads]"
         *              item-click-trees-map-field="field1"
         *              item-click-trees-context-field="field2"
         *              item-click-roads-map-field="field1"
         *              item-click-roads-context-field="field3">
         *     </ods-map-legacy>
         * </pre>
         * @param {string} [itemClickMapField=none] If you are using `itemClickContext` and want to filter on the value of a field instead of a spatial query, you can use this parameter to specify the name of the field to take
         * the value from. This must be a field from the dataset displayed on the map. It must be used together with `itemClickContextField`.
         * @param {string} [itemClickContextField=none] This parameter specifies the field to filter on in the context configured in `itemClickContext`. It must be used together with `itemClickMapField`.
         * The field must be a facet.
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-dataset-context context="stations" stations-domain="public.opendatasoft.com" stations-dataset="jcdecaux_bike_data">
         *              <ods-map-legacy context="stations"></ods-map-legacy>
         *          </ods-dataset-context>
         *      </file>
         *  </example>
         */
        return {
            restrict: 'E',
            scope: {
                context: '=',
                embedMode: '@', // FIXME: This concept is not useful, we could remove it and use the more explicit settings to achieve the same effects
                autoResize: '@',
                mapContext: '=?',
                location: '@',
                basemap: '@',
                isStatic: '@',
                showFilters: '@',
                itemClickContext: '=',
                colorBy: '@',
                colorByField: '@',
                colorByContext: '=',
                colorByAggregationKey: '@',
                colorByKey: '@',
                colorByExpression: '@',
                colorByFunction: '@',
                colorByRanges: '@',
                colorByRangesColors: '@'
            },
            replace: true,
            template: function(tElement) {
                tElement.contents().wrapAll('<div>');
                if (tElement.contents().length > 0 && tElement.contents().html().trim().length > 0) {
                    tElement.contents().wrapAll('<div>');
                    tElement.data('tooltip-template', tElement.children().html());
                }
                return '<div class="odswidget odswidget-map">' +
                        '<div class="odswidget-map__map"></div>' +
                        '<div class="odswidget-overlay map odswidget-overlay--opaque" ng-show="pendingRequests.length && initialLoading"><ods-spinner></ods-spinner></div>' +
                    '</div>';
            },
            link: function(scope, element) {
                if (angular.isUndefined(scope.mapContext)) {
                    scope.mapContext = {};
                    if (scope.location) {
                        scope.mapContext.location = scope.location;
                    }
                    if (scope.basemap) {
                        scope.mapContext.basemap = scope.basemap;
                    }
                }

                function resizeMap(){
                    if ($('.odswidget-map__map').length > 0) {
                        // Only do this if visible
                        $('.odswidget-map__map').height(Math.max(200, $(window).height() - $('.odswidget-map__map').offset().top));
                    }
                }
                if (scope.autoResize === 'true') {
                    $(window).on('resize', resizeMap);
                    resizeMap();
                }
                ModuleLazyLoader('leaflet').then(function() {
                    // Define the "Filter By Map View" button
                    L.Control.FilterByView = L.Control.extend({
                        options: {
                            position: 'topright'
                        },

                        onAdd: function (map) {
                            var className = 'leaflet-control-filterview',
                                classNames = className + ' leaflet-bar leaflet-control',
                                container = L.DomUtil.create('div', classNames);

                            var link = L.DomUtil.create('a', 'leaflet-bar-part', container);
                            link.href = '#';
                            //link.title = 'Filter the data to what you see on the map';

                            if (scope.mapViewFilter) {
                                container.className = classNames + ' active';
                            }

                            L.DomEvent
                                .on(link, 'click', L.DomEvent.stopPropagation)
                                .on(link, 'click', L.DomEvent.preventDefault)
                                .on(link, 'click', function() {
                                    // Toggle the active filter view
                                    scope.$apply(function(scope) {
                                        scope.mapViewFilter = !scope.mapViewFilter;
                                    });
                                    if (scope.mapViewFilter) {
                                        container.className = classNames + ' active';
                                    } else {
                                        container.className = classNames;
                                    }
                                    return false;
                                })
                                .on(link, 'dblclick', L.DomEvent.stopPropagation);

                            scope.$watch('mapViewFilter', function(newValue, oldValue) {
                                // Change the button style if the filter is deactivated from outside
                                if (newValue === oldValue) return;
                                if (newValue) {
                                    container.className = classNames + ' active';
                                } else {
                                    container.className = classNames;
                                }
                            });
                            // FIXME: Plug it to a working ods-tooltip
//                            if ($) {
//                                $(link).tooltip({
//                                    placement: 'left',
//                                    title: '<div style="white-space: nowrap; width: auto;" translate>Filter the data to what you see on the map</div>',
//                                    html: true
//                                });
//                            }

                            return container;
                        }

                    });

                    scope.initMap = function(dataset, embedMode, basemapsList, translate, geobox, basemap, staticMap, prependAttribution, language) {

                        var mapOptions = {
                            basemapsList: basemapsList,
                            worldCopyJump: true,
                            minZoom: 2,
                            basemap: basemap,
                            dragging: !staticMap,
                            zoomControl: !staticMap,
                            prependAttribution: prependAttribution
                        };

                        if (staticMap) {
                            mapOptions.doubleClickZoom = false;
                            mapOptions.scrollWheelZoom = false;
                        }
                        var map = new L.ODSMap(element.children()[0], mapOptions);

    //                    map.setView(new L.LatLng(48.8567, 2.3508),13);
                        map.addControl(new L.Control.Scale());

                        if (geobox && !staticMap) {
                            var geocoder = L.Control.geocoder({
                                placeholder: translate('Find a place...'),
                                errorMessage: translate('Nothing found.'),
                                geocoder: new L.Control.Geocoder.Nominatim({serviceUrl: "https://nominatim.openstreetmap.org/", geocodingQueryParams: {"accept-language": language || 'en', "polygon_geojson": true}})
                            });
                            geocoder.markGeocode = function(result) {
                                map.fitBounds(result.bbox);

                                if (result.properties.geojson) {
                                    var highlight = L.geoJson(result.properties.geojson, {
                                        style: function () {
                                            return {
                                                opacity: 0,
                                                fillOpacity: 0.8,
                                                fillColor: 'orange',
                                                className: 'leaflet-geocoder-highlight'
                                            };
                                        }
                                    });
                                    map.addLayer(highlight);
                                    $timeout(function () {
                                        element.addClass('geocoder-highlight-on');
                                    }, 0);
                                    $timeout(function () {
                                        element.removeClass('geocoder-highlight-on');
                                        map.removeLayer(highlight);
                                    }, 2500);
                                }
                            };
                            map.addControl(geocoder);
                        }

                        if (embedMode !== 'true') {
                            if (scope.showFilters === 'true') {
                                map.addControl(new L.Control.FilterByView());
                            }
                            map.addControl(new L.Control.Fullscreen());
                        }

                        if (!staticMap) {
                            map.addControl(new L.Control.Locate({maxZoom: 18}));
                        }

                        map.on('popupclose', function(e) {
                            jQuery(e.popup.getContent()).trigger('popupclose');
                        });

                        scope.map = map;
                    };
                });
            },
            controller: ['$scope', '$http', '$compile', '$q', '$filter', '$element', 'translate', 'ODSAPI', 'DebugLogger', 'ODSWidgetsConfig', '$attrs', function($scope, $http, $compile, $q, $filter, $element, translate, ODSAPI, DebugLogger, ODSWidgetsConfig, $attrs) {
                DebugLogger.log('init map');

                $scope.pendingRequests = $http.pendingRequests;
                $scope.initialLoading = true;

                if ($scope.itemClickMapField && !$scope.itemClickContextField || !$scope.itemClickMapField && $scope.itemClickContextField) {
                    console.log('ERROR: You need to configure both item-click-context-field and item-click-map-field.');
                }

                var shapeField = null;
                var createMarker = null;
                var colorAggregation;

                var locationParameterFunctions = {
                    delimiter: ',',
                    accuracy: 5,
                    formatLatLng: function(latLng) {
                        var lat = L.Util.formatNum(latLng.lat, this.accuracy);
                        var lng = L.Util.formatNum(latLng.lng, this.accuracy);
                        return new L.latLng(lat, lng);
                    },
                    getLocationParameterAsArray: function(location) {
                        return location.split(this.delimiter);
                    },
                    getLocationParameterFromMap: function(map) {
                        var center = this.formatLatLng(map.getCenter());
                        return map.getZoom() + this.delimiter + center.lat + this.delimiter + center.lng;
                    },
                    getCenterFromLocationParameter: function(location) {
                        var a = this.getLocationParameterAsArray(location);
                        return new L.latLng(a[1], a[2]);
                    },
                    getZoomFromLocationParameter: function(location) {
                        return this.getLocationParameterAsArray(location)[0];
                    }
                };

                var propagateSpatialItemClickToContext = function(context, shape) {
                    ODS.GeoFilter.addGeoFilterFromSpatialObject(context.parameters, shape);
                };

                var propagateItemClickToContext = function(context, mapField, contextField, record) {
                    if (angular.isDefined(record.fields[mapField])) {
                        // Until we can have named parameters, we need to avoid using the q= parameter as it will quickly
                        // conflict with other widgets that need to interact with the query.
                        context.parameters['refine.'+contextField] = record.fields[mapField];
//                        context.parameters.q = contextField + ':"' + record.fields[mapField] + '"';
                    }
                };

                var propagateToContext = function(context, mapField, contextField, shape, record) {
                    if (!mapField && !contextField) {
                        $scope.$apply(function() {
                            propagateSpatialItemClickToContext(context, shape);
                        });
                    } else if (record) {
                        $scope.$apply(function() {
                            propagateItemClickToContext(context, mapField, contextField, record);
                        });
                    } else {
                        // We need to retrieve a record for this to work
                        var options = {};
                        ODS.GeoFilter.addGeoFilterFromSpatialObject(options, shape);
                        jQuery.extend(
                            options,
                            $scope.staticSearchOptions,
                            $scope.context.parameters,
                            {'rows': 1});
                        ODSAPI.records.download($scope.context, options).success(function(data) {
                            propagateItemClickToContext(context, mapField, contextField, data[0]);
                        });
                    }
                };

                var clickOnItem = function(latLng, shape, recordid, record) {
                    // This method is triggered when the user clicks on a marker or anything that triggers a "selection"
                    // of something (a shape, a cluster that can't be more precise...).
                    var mapField, contextField, context;
                    if ($scope.itemClickContext) {
                        // Trigger a change in another context
                        if (angular.isArray($scope.itemClickContext)) {
                            // Multiple contexts
                            angular.forEach($scope.itemClickContext, function(context) {
                                contextField = $attrs['itemClick'+ODS.StringUtils.capitalize(context.name)+'ContextField'];
                                mapField = $attrs['itemClick'+ODS.StringUtils.capitalize(context.name)+'MapField'];
                                propagateToContext(context, mapField, contextField, shape, record);
                            });
                        } else {
                            // Single context
                            context = $scope.itemClickContext;
                            // If there is only one context, precising its name in the attributs is optional
                            contextField = $attrs['itemClick'+ODS.StringUtils.capitalize(context.name)+'ContextField'] || $attrs.itemClickContextField;
                            mapField = $attrs['itemClick'+ODS.StringUtils.capitalize(context.name)+'MapField'] || $attrs.itemClickMapField;
                            propagateToContext(context, mapField, contextField, shape, record);
                        }
                    } else {
                        // Good ol' popup
                        var newScope = $scope.$new(false);
                        if (recordid) {
                            newScope.recordid = recordid;
                        } else {
                            newScope.shape = shape;
                        }
                        var popupOptions = {
                            offset: [0, -30],
                            maxWidth: 250,
                            minWidth: 250,
                            autoPanPaddingTopLeft: [50, 305],
                            autoPan: !$scope.mapViewFilter && !$scope.staticMap
                        };
                        var html = $element.data('tooltip-template');
                        if (angular.isUndefined(html) || !angular.isString(html) || html.trim() === '') {
                            // If no template explicitely passed in the odsMap tag, we look into the map map_tooltip_html.
                            if ($scope.context.dataset.extra_metas && $scope.context.dataset.extra_metas.visualization && $scope.context.dataset.extra_metas.visualization.map_tooltip_html) {
                                html = $scope.context.dataset.extra_metas.visualization.map_tooltip_html;
                            } else {
                                html = '';
                            }
                        }
                        newScope.template = html;
                        var popup = new L.Popup(popupOptions).setLatLng(latLng)
                            .setContent($compile('<ods-map-tooltip shape="shape" context="context" recordid="recordid" map="map" template="{{template}}"></ods-map-tooltip>')(newScope)[0]);
                        popup.openOn($scope.map);
                    }
                };

                var numberFormatting = function(number) {
                    /* Passed as a callback for the cluster markers, to allow them to format their displayed value */
                    // Limiting the digits
                    number = Math.round(number*100)/100;
                    // Formatting the digits
                    number = $filter('number')(number);
                    return number;
                };

                var addClusterToLayerGroup = function(layerGroup) {
                    return function(cluster, maximum) {
                        if (cluster.count > 1) {
                            var clusterMarker = new L.ClusterMarker(cluster.cluster_center, {
                                geojson: cluster.cluster,
                                value: cluster.count,
                                total: maximum,
                                numberFormattingFunction: numberFormatting,
                                color: $scope.markerColor
                            });

                            if (!$scope.staticMap) {
                                clusterMarker.on('click', function (e) {
                                    if ($scope.map.getZoom() === $scope.map.getMaxZoom()) {
                                        clickOnItem(marker.getLatLng(), cluster.cluster);
                                    } else {
                                        // Get the boundingbox for the content
                                        $scope.$apply(function () {
                                            if (cluster.cluster) {
                                                if (cluster.cluster.type === 'Point') {
                                                    $scope.map.fitBounds([
                                                        [cluster.cluster.coordinates[1], cluster.cluster.coordinates[0]],
                                                        [cluster.cluster.coordinates[1], cluster.cluster.coordinates[0]]
                                                    ]);
                                                } else {
                                                    var options = {};
                                                    // The geofilter.polygon has to be added last because if we are in mapViewFilter mode,
                                                    // the searchOptions already contains a geofilter

                                                    // FIXME: This is a workaround until we know we can safely do polygon requests for the clusters.
                                                    // See https://github.com/opendatasoft/platform/issues/2116
    //                                                var polygonParameter = ODS.GeoFilter.getGeoJSONPolygonAsPolygonParameter(cluster.cluster); // This is the normal good one
                                                    var polygonParameter = ODS.GeoFilter.getBoundsAsPolygonParameter(L.geoJson(cluster.cluster).getBounds()); // This is the workaround

                                                    jQuery.extend(options, $scope.staticSearchOptions, $scope.context.parameters, {
                                                        'geofilter.polygon': polygonParameter
                                                    });
                                                    ODSAPI.records.boundingbox($scope.context, options).success(function (data) {
                                                        $scope.map.fitBounds([
                                                            [data.bbox[1], data.bbox[0]],
                                                            [data.bbox[3], data.bbox[2]]
                                                        ]);
                                                    });
                                                }
                                            } else {
                                                $scope.map.setView(e.latlng, $scope.map.getZoom()+2);
                                            }
                                        });
                                    }
                                });
                            }

                            layerGroup.addLayer(clusterMarker);
                        } else {
                            var singleMarker = createMarker(cluster.cluster_center);
                            singleMarker.on('click', function(e) {
                                clickOnItem(e.target.getLatLng(), cluster.cluster);
                            });
                            layerGroup.addLayer(singleMarker);
                        }
                    };
                };

                var refreshClusteredGeo = function(showPolygons) {
                    var options = {
                        'geofilter.polygon': ODS.GeoFilter.getBoundsAsPolygonParameter($scope.map.getBounds()),
                        'clusterprecision': $scope.map.getZoom(),
                        'clusterdistance': 50,
                        'return_polygons': showPolygons
                    };
                    jQuery.extend(options, $scope.staticSearchOptions, $scope.context.parameters);
                    if ($scope.currentClusterRequestCanceler) {
                        $scope.currentClusterRequestCanceler.resolve();
                    }
                    $scope.currentClusterRequestCanceler = $q.defer();
                    ODSAPI.records.geo($scope.context, options, $scope.currentClusterRequestCanceler.promise).success(function(data) {
                        var clusters = data.clusters;
                        $scope.records = clusters ? clusters.length : 0;
                        var layerGroup = new L.LayerGroup();
        //                var bounds = new L.LatLngBounds();
                        var clusterStacker = addClusterToLayerGroup(layerGroup);
                        for (var i=0; i<clusters.length; i++) {
                            var cluster = clusters[i];
                            clusterStacker(cluster, data.count.max);
                        }

                        // Switch the layers
                        layerGroup.addTo($scope.map);
                        if ($scope.layerGroup) {
                            $scope.map.removeLayer($scope.layerGroup);
                        }

                        $scope.layerGroup = layerGroup;

                        $scope.initialLoading = false;

                        $scope.currentClusterRequestCanceler = null;
                    });
                };

                var refreshShapePreview = function() {
                    var options = {
                        'geofilter.polygon': ODS.GeoFilter.getBoundsAsPolygonParameter($scope.map.getBounds()),
                        'clusterprecision': $scope.map.getZoom()
                    };
                    jQuery.extend(options, $scope.staticSearchOptions, $scope.context.parameters);
                    options.rows = 1000;
                    if ($scope.currentClusterRequestCanceler) {
                        $scope.currentClusterRequestCanceler.resolve();
                    }
                    $scope.currentClusterRequestCanceler = $q.defer();
                    ODSAPI.records.geopreview($scope.context, options, $scope.currentClusterRequestCanceler.promise).success(function(data) {

                        var layerGroup = new L.LayerGroup();
                        for (var i = 0; i < data.length; i++) {
                            drawShapePreview(layerGroup, data[i]);
                        }

                        // Switch the layers
                        layerGroup.addTo($scope.map);
                        if ($scope.layerGroup) {
                            $scope.map.removeLayer($scope.layerGroup);
                        }

                        $scope.layerGroup = layerGroup;
                        $scope.initialLoading = false;
                        $scope.currentClusterRequestCanceler = null;
                    });
                };

                var drawShapePreview = function(layerGroup, shape) {
                    var geojsonMarkerOptions = {
                        radius: 3,
                        fillColor: "#0033ff",
                        color: "#0000ff",
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.5
                    };

                    var shapeLayer = new L.GeoJSON(shape.geometry, {
                        pointToLayer: function (feature, latlng) {
                            return L.circleMarker(latlng, geojsonMarkerOptions);
                        }
                    });

                    layerGroup.addLayer(shapeLayer);
                    shapeLayer.on('click', function(e) {
                        clickOnItem(e.latlng, shape.geometry, shape.id); //shape
                    });
                };

                var getAggregationColor = function(value) {
                    var i;

                    for (i=0; i<colorAggregation.ranges.length; i++) {
                        if (value < colorAggregation.ranges[i]) {
                            return colorAggregation.colors[i];
                        }
                    }
                    return colorAggregation.colors[colorAggregation.colors.length-1];
                };

                var refreshAggregation = function() {
                    var options = angular.extend({}, colorAggregation.context.parameters, {
                        'join.geo.remotedataset': $scope.context.dataset.datasetid,
                        'join.geo.localkey': colorAggregation.localkey,
                        'join.geo.remotekey': colorAggregation.remotekey,
                        'y.agg.expr': colorAggregation.expr,
                        'y.agg.func': colorAggregation.func
                    });
                    var layerGroup = new L.LayerGroup();
                    var bounds = new L.LatLngBounds();
                    var markers = new L.FeatureGroup();

                    // We're stubbing a dataset context
                    ODSAPI.records.analyze(colorAggregation.context, options).
                        success(function(data) {
                            angular.forEach(data, function(result) {
                                var records = result.x;
                                var value = result.agg;
                                angular.forEach(records, function(record) {
                                    drawGeoJSON(record, layerGroup, bounds, markers, getAggregationColor(value));
                                });
                            });

                            if ($scope.layerGroup) {
                                $scope.map.removeLayer($scope.layerGroup);
                            }
                            layerGroup.addLayer(markers);
                            layerGroup.addTo($scope.map);
                            $scope.layerGroup = layerGroup;

                            $scope.initialLoading = false;
                        });
                };

                var refreshRawGeo = function() {
                    var options = {};
                    options['geofilter.polygon'] = ODS.GeoFilter.getBoundsAsPolygonParameter($scope.map.getBounds());
                    jQuery.extend(options, $scope.staticSearchOptions, $scope.context.parameters);
                    DebugLogger.log('map -> download');
                    ODSAPI.records.download($scope.context, options).
                        success(function(data, status, headers, config) {
                            $scope.records = data;
                            $scope.error = '';
                            $scope.nhits = data.length;

                            var layerGroup = new L.LayerGroup();
                            var bounds = new L.LatLngBounds();
                            var markers = new L.FeatureGroup();

                            for (var i=0; i<data.length; i++) {
                                var record = data[i];
                                drawGeoJSON(record, layerGroup, bounds, markers);
                            }

                            if ($scope.layerGroup)
                                $scope.map.removeLayer($scope.layerGroup);
                            layerGroup.addLayer(markers);
                            layerGroup.addTo($scope.map);
                            $scope.layerGroup = layerGroup;

                            $scope.initialLoading = false;
                        }).
                        error(function(data, status, headers, config) {
                            $scope.error = data.error;
                            $scope.initialLoading = false;
                        });
                };

                var drawGeoJSON = function(record, layerGroup, bounds, markers, color) {
                    var geoJSON;
                    var drawColor = color;
                    if ($scope.colorBy === 'value') {
                        var colorByVal = record.fields[colorAggregation.field];
                        if (colorByVal) {
                            drawColor = getAggregationColor(colorByVal);
                        }
                    }
                    if (shapeField) {
                        if (record.fields[shapeField]) {
                            geoJSON = record.fields[shapeField];
                            if (geoJSON.type === 'Point' && angular.isDefined(record.geometry)) {
                                // Due to a problem with how we handke precisions, we query a point with a lower precision than
                                // the geoJSON, so we need to use the geometry field instead.
                                geoJSON = record.geometry;
                            }
                        } else {
                            // The designated shapefield has no value, skip
                            return;
                        }
                    } else if (record.geometry) {
                        geoJSON = record.geometry;
                    } else {
                        return;
                    }

                    if (geoJSON.type == 'Point') {
                        // We regroup all the markers in one layer so that we can clusterize them
                        var point = new L.LatLng(geoJSON.coordinates[1], geoJSON.coordinates[0]);
                        var marker = createMarker(point, drawColor);
                        marker.on('click', function(e) {
                            clickOnItem(e.target.getLatLng(), geoJSON, null, record);
                        });
                        markers.addLayer(marker);
                        bounds.extend(point);
                    } else {
                        var layer;
                        if (drawColor) {
                            layer = new L.GeoJSON(geoJSON, {
                                style: function(feature) {
                                    var opts = {
                                        radius: 3,
                                        weight: 1,
                                        opacity: 0.9,
                                        fillOpacity: 0.5,
                                        color: drawColor
                                    };
                                    opts.fillColor = drawColor;
                                    if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
                                        opts.weight = 5;
                                        opts.color = drawColor;
                                    } else {
                                        opts.color = "#fff";
                                    }
                                    return opts;
                                }
                            });
                        } else {
                            layer = new L.GeoJSON(geoJSON);
                        }
                        layer.on('click', function(e) {
                            // For geometries, we bind the popup query to the center
                            clickOnItem(L.latLng(record.geometry.coordinates[1], record.geometry.coordinates[0]), geoJSON, record.recordid, record); //shape
                        });
                        layerGroup.addLayer(layer);
                        bounds.extend(layer.getBounds());
                    }
                };

                $scope.$watch('context.parameters', function(newValue, oldValue) {
                    // Don't fire at initialization time
                    if (newValue === oldValue) return;
                    if ($scope.initialLoading) return;
                    DebugLogger.log('map -> searchOptions watch -> refresh records');

                    // If the polygon parameter didn't change, we can fit bounds. Else, it means the user dragged the map, and we
                    // don't want to fit again.

                    if (!newValue['geofilter.polygon'] && oldValue['geofilter.polygon']) {
                        // Someone removed the geofilter parameter, we need to disable the map view filter
                        $scope.mapViewFilter = false;
                        // No reason to go further: the map shouldn't move just because someone removed the filter
                        return;
                    } else if (!oldValue['geofilter.polygon'] && newValue['geofilter.polygon']) {
                        $scope.mapViewFilter = true;
                        // Adding the geofilter parameter shouldn't trigger a refresh
                        return;
                    }

                    if ($scope.mapViewFilter) {
                        refreshRecords(false);
                    } else {
                        // This is not a viewport change: this comes from a filter modification, so we want to refit
                        refreshRecords(true);
                    }
                }, true);

                if ($scope.colorBy === 'aggregation') {
                    $scope.$watch('colorByContext.parameters', function() {
                        if ($scope.map) {
                            refreshRecords(false);
                        }
                    }, true);
                }

                $scope.$watch('mapContext.location', function() {
                    if ($scope.map) {
                        refreshRecords(false);
                    }
                }, true);

                var refreshRecords = function(globalSearch) {
                    var DOWNLOAD_CAP = 200;
                    var SHAPEPREVIEW_HIGHCAP = 500000;
                    // The number of points where we stop asking for the polygon representing the cluster's content
                    var POLYGONCLUSTERS_HIGHCAP = 500000;

                    var refresh = function(data) {
                        if ($scope.colorBy === 'aggregation') {
                            refreshAggregation();
                        } else if ($scope.colorBy === 'value' || data.count < DOWNLOAD_CAP || $scope.map.getZoom() === $scope.map.getMaxZoom()) {
                            // Low enough: always download
                            refreshRawGeo();
                        } else if (data.count < SHAPEPREVIEW_HIGHCAP) {
                            // We take our decision depending on the content of the envelope
                            if (data.geometries.Point && data.geometries.Point > data.count/2) {
                                refreshClusteredGeo(data.count <= POLYGONCLUSTERS_HIGHCAP);
                            } else {
                                refreshShapePreview();
                            }

                        } else {
                            // Cluster no matter what
                            refreshClusteredGeo(data.count <= POLYGONCLUSTERS_HIGHCAP);
                        }
                    };

                    var options = {
                        'without_bbox': !globalSearch
                    };
                    if (!globalSearch) {
                        // Stay within the viewport
                        options['geofilter.polygon'] = ODS.GeoFilter.getBoundsAsPolygonParameter($scope.map.getBounds());
                    }
                    jQuery.extend(options, $scope.staticSearchOptions, $scope.context.parameters);
                    ODSAPI.records.boundingbox($scope.context, options).success(function(data) {
                        if (globalSearch) {
                            // We manually move the map and trigger the refreshes on the new viewport
                            if (data.bbox.length > 0) {
                                var oldBounds = $scope.map.getBounds();
                                $scope.map.fitBounds([[data.bbox[1], data.bbox[0]], [data.bbox[3], data.bbox[2]]]);
                                var newBounds = $scope.map.getBounds();
                                // FIXME: This comparison doesn't seem to work very much... but worst case we run
                                // two queries, and the first one is immediately cancelled
                                if (angular.equals(oldBounds, newBounds)) {
                                    // We need a refresh even though the map didn't move
                                    refresh(data);
                                }

                            } else {
                                // We know we have no data, and we can't count on a viewport move to refresh it
                                refresh(data);
                            }
                        } else {
                            refresh(data);
                        }
                    });
                };

                var onViewportMove = function(map) {
                    var size = map.getSize();
                    if (size.x > 0 && size.y > 0) {
                        // Don't attempt to do anything if the map is not displayed... we can't capture useful bounds
        //                var param = ODS.GeoFilter.getBoundsAsPolygonParameter(map.getBounds());
                        $scope.mapContext.location = locationParameterFunctions.getLocationParameterFromMap(map);
                        if ($scope.mapViewFilter) {
                            // Generate a polygon from the bounds
                            $scope.context.parameters['geofilter.polygon'] = ODS.GeoFilter.getBoundsAsPolygonParameter(map.getBounds());
                        }
                    }
                };

                var unwatchSchema = $scope.$watch('[context.dataset, colorByContext.dataset]', function(newValue, oldValue) {
                    if (!newValue[0] || !newValue[0].datasetid) return;

                    if ($scope.colorBy === 'aggregation' && (!newValue[1] || !newValue[1].datasetid)) return;

                    if ($scope.colorBy === 'aggregation') {
                        // We want to color our geo depending on an aggregation on a remote dataset
                        colorAggregation = {
                            context: $scope.colorByContext,
                            localkey: $scope.colorByAggregationKey || $scope.colorByKey,
                            remotekey: $scope.colorByKey,
                            expr: $scope.colorByExpression,
                            func: $scope.colorByFunction,
                            ranges: $scope.colorByRanges.split(','),
                            colors: $scope.colorByRangesColors.split(',')
                        };
                    } else if ($scope.colorBy === 'value') {
                        colorAggregation = {
                            field: $scope.colorByField,
                            ranges: $scope.colorByRanges.split(','),
                            colors: $scope.colorByRangesColors.split(',')
                        };
                    }

                    newValue = newValue[0];

                    // For now the only way to have the geofilter parameter is to enable the map view filter
                    if ($scope.context.parameters['geofilter.polygon']) {
                        $scope.mapViewFilter = true;
                    } else {
                        $scope.mapViewFilter = false;
                    }

                    $scope.staticMap = $scope.isStatic === 'true' || $scope.context.parameters.static === 'true';

                    // Wait for initMap to be ready (lazy loading)
                    var unwatchInit = $scope.$watch('initMap', function() {
                        if ($scope.initMap) {
                            unwatchInit();
                            $scope.initMap(newValue, $scope.embedMode, ODSWidgetsConfig.basemaps, translate, ODSWidgetsConfig.mapGeobox, $scope.mapContext.basemap, $scope.staticMap, ODSWidgetsConfig.mapPrependAttribution, ODSWidgetsConfig.language);
                        }
                    });
                    unwatchSchema();
                    $scope.staticSearchOptions = {
                        rows: $scope.recordLimit,
                        dataset: $scope.context.dataset.datasetid,
                        format: 'json'
                    };
                    for (var i=0; i<newValue.fields.length; i++) {
                        var field = newValue.fields[i];
                        if (field.type === 'geo_shape') {
                            shapeField = field.name;
                            // The first one is enough
                            break;
                        }
                    }

                    // Display settings
                    var visualization = {};
                    if (newValue.extra_metas && newValue.extra_metas.visualization) {
                        visualization = newValue.extra_metas.visualization;
                    }
                    $scope.markerColor = visualization.map_marker_color || '#29398C';
                    createMarker = function(latLng, color) {
                        return new L.VectorMarker(latLng, {
                            color: color || $scope.markerColor,
                            icon: visualization.map_marker_picto || 'icon-circle',
                            marker: !visualization.map_marker_hidemarkershape
                        });
                    };

                    DebugLogger.log('map -> dataset watch -> refresh records');

                    var mapInitWatcher = $scope.$watch('map', function(nv, ov){
                        if (nv) {
                            $scope.$watch('mapViewFilter', function(newValue, oldValue) {
                                // Don't fire at initialization time
                                if (newValue === oldValue) return;
                                if (newValue) {
                                    $scope.context.parameters['geofilter.polygon'] = ODS.GeoFilter.getBoundsAsPolygonParameter($scope.map.getBounds());
                                } else {
                                    if ($scope.context.parameters['geofilter.polygon'])
                                        delete $scope.context.parameters['geofilter.polygon'];
                                }
                            });
                            var boundsRetrieval = function(dataset) {
                                var deferred = $q.defer();

                                if ($scope.context.parameters.mapviewport) {

                                    if ($scope.context.parameters.mapviewport.substring(0, 1) === '(') {
                                        // Legacy support
                                        $scope.context.parameters.mapviewport = ODS.GeoFilter.getBoundsAsBboxParameter(ODS.GeoFilter.getPolygonParameterAsBounds($scope.context.parameters.mapviewport));
                                    }
                                    deferred.resolve(ODS.GeoFilter.getBboxParameterAsBounds($scope.context.parameters.mapviewport));
                                } else if ($scope.context.parameters["geofilter.polygon"]) {
                                    deferred.resolve(ODS.GeoFilter.getPolygonParameterAsBounds($scope.context.parameters["geofilter.polygon"]));
                                } else {
                                    // Get the boundingbox from the API
                                    var options = {};
                                    jQuery.extend(options, $scope.staticSearchOptions, $scope.context.parameters);
                                    ODSAPI.records.boundingbox($scope.context, options).success(function(data) {
                                        if (data.count > 0) {
                                            deferred.resolve([[data.bbox[1], data.bbox[0]], [data.bbox[3], data.bbox[2]]]);
                                        } else {
                                            // Fallback to... the world
                                            deferred.resolve([[-60, -180], [80, 180]]);
                                        }
                                    });
                                }

                                return deferred.promise;
                            };

                            var setMapView = function() {
                                var deferred = $q.defer();

                                if ($scope.mapContext.location) {
                                    DebugLogger.log('Location found');
                                    var center = locationParameterFunctions.getCenterFromLocationParameter($scope.mapContext.location);
                                    var zoom = locationParameterFunctions.getZoomFromLocationParameter($scope.mapContext.location);
                                    DebugLogger.log(center, zoom);
                                    nv.setView(center, zoom);

                                    refreshRecords(false);

                                    deferred.resolve();
                                } else {
                                    DebugLogger.log('Use boundsRetrieval');
                                    boundsRetrieval($scope.context.dataset).then(function(bounds) {
                                        if ($scope.context.parameters.mapviewport) {
                                            DebugLogger.log('Deleted mapviewport');
                                            delete $scope.context.parameters.mapviewport;
                                        }

                                        // Fit to dataset boundingbox if there is no viewport or geofilter
                                        DebugLogger.log(bounds);
                                        nv.fitBounds(bounds);

                                        deferred.resolve();
                                    });
                                }

                                return deferred.promise;
                            };

                            setMapView().then(function() {
                                DebugLogger.log('First onViewportMove');
                                onViewportMove($scope.map);

                                $scope.map.on('moveend', function(e) {
                                    // Whenever the map moves, we update the displayed data
                                    onViewportMove(e.target);
                                    if(!$scope.$$phase && !$scope.$root.$$phase) {
                                        // Don't trigger a digest if it is already running (for example if a fitBounds is
                                        // triggered from within a apply)
                                        $scope.$apply();
                                    }
                                });
                            });

                            if (ODSWidgetsConfig.basemaps.length > 1) {
                                $scope.map.on('baselayerchange', function (e) {
                                    $scope.mapContext.basemap = e.layer.basemapId;
                                    if(!$scope.$$phase && !$scope.$root.$$phase) {
                                        // Don't trigger a digest if it is already running (for example if a fitBounds is
                                        // triggered from within a apply)
                                        $scope.$apply();
                                    }
                                });
                            }

                            mapInitWatcher();
                        }
                    });

                }, true);

            }]

        };
    }]);
}());;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    /*
    NOTE: There has been a change in terminology between Cartograph v1 and Cartograph v2 (current version); due to
    retrocompatibility reasons, the old terminology is still used in the map data structure, and therefore you will
    encounter references to it in the code.
    - A "layer" (a group of datasets that you can show/hide and document) is now a "layer group"
    - An "active dataset" is now a "layer"
     */

    /* Migration note (for Cartograph)
      "activeDatasets": [
        {
          "searchParameters": {},
          "color": "#C32D1C",
          "expr": "id_geofla",
          "picto": "icon-circle",
          "clusterMode": "polygon",
          "func": "COUNT",
          "marker": true,
          "datasetid": "geoflar-communes-2"
        },

        BECOMES
      "activeDatasets": [
        {
          "context": <context>
          "color": "#C32D1C",
          "expr": "id_geofla",
          "picto": "icon-circle",
          "clusterMode": "polygon",
          "func": "COUNT",
          "marker": true,
        },

     When persisting, the context can be serialized as a datasetid and searchparameters. We trust Cartograph to make the
     transformation in both direction.
     */
    mod.directive('odsMap', ['URLSynchronizer', 'MapHelper', 'ModuleLazyLoader', 'ODSWidgetsConfig', 'MapLayerRenderer', 'translate', '$q', '$timeout', function(URLSynchronizer, MapHelper, ModuleLazyLoader, ODSWidgetsConfig, MapLayerRenderer, translate, $q, $timeout) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsMap
         * @scope
         * @restrict E
         * @param {DatasetContext} context {@link ods-widgets.directive:odsDatasetContext Dataset Context} to use
         * @param {boolean} [syncToUrl] If true, persists the `location` and `basemap` in the page's URL.
         * @param {Object} [syncToObject] An object where the `location` and `basemap` selection is kept. You can use it from
         * another widget to read the location or basemap.
         * @param {string} [location] The default location of the map upon initialization, under the following format: "zoom,latitude,longitude".
         * For example, to have a map centered on Paris, France, you can use "12,48.85218,2.36996". By default, if a location is not specified,
         * the map will try to fit all the displayed data when initializing.
         * @param {string} [basemap] The identifier of the basemap to use by default, as defined in {@link ods-widgets.ODSWidgetsConfigProvider ODSWidgetsConfig.basemaps}. By default,
         * the first available basemap will be used.
         * @param {boolean} [staticMap] If "true", then users won't be able to move or zoom on the map. They will still be able to click on markers.
         * @param {boolean} [noRefit] By default, the map refits its view whenever the displayed data changes.
         * If "true", then the map will stay at the same location instead.
         * @param {boolean} [toolbarGeolocation=true] If "false", then the "geolocate" button won't be displayed in the map's toolbar.
         * @param {boolean} [toolbarDrawing=true] If "false", then the drawing tools (to draw filter areas) won't be displayed in the map's toolbar.
         * @param {boolean} [toolbarFullscreen=true] If "false", then the "go fullscreen" button won't be displayed in the map's toolbar.
         * @param {boolean} [scrollWheelZoom=true] If "false", then scrolling your mouse wheel over the map won't zoom/unzoom it.
         * @param {integer} [minZoom=none] Limits the map to a minimum zoom value. By default this is defined by the minimum zoom of the basemap.
         * @param {integer} [maxZoom=none] Limits the map to a maximum zoom value. By default this is defined by the maximum zoom of the basemap.
         * @param {boolean} [odsAutoResize] see {@link ods-widgets.directive:odsAutoResize Auto Resize} for more informations
         * @description
         * This widget allows you to build a map visualization and show data using various modes of display using layers.
         * Each layer is based on a {@link ods-widgets.directive:odsDatasetContext Dataset Context}, a mode of display (clusters...), and various properties to define the
         * display itself, such as colors.
         *
         * Layers can be combined, so that you map shows various data sources in various ways.
         *
         * Layers are dynamic, which means that if a context changes (e.g. a new refine is added), the layer will be refreshed and display the new relevant data.
         *
         * This widget can also be used to control other widgets: you can configure a layer to act as a refine control on another context, so that for example
         * if you click on a road you get a {@link ods-widgets.directive:odsTable table view} of the traffic on that road. You can also draw zones on the map,
         * which will accordingly refine the context.
         *
         * You can use the widget alone to propose a simple map using default settings, such as this:
         * <pre>
         *     <!-- Displays a map of Paris using the data from mycontext and an automatic visualization mode (clusters or shapes depending on the zoom level) -->
         *     <ods-map context="mycontext" location="12,48.85218,2.36996"></ods-map>
         * </pre>
         *
         * However, the ability to build a more advanced and configurable map comes with a second `odsMapLayer` tag, used to define a layer:
         *
         * <pre>
         *     <!-- A map containing a single layer to display data from mycontext, in a specific color, and as clusters. -->
         *     <ods-map>
         *         <ods-map-layer context="mycontext" color="#FF0000" display="clusters"></ods-map-layer>
         *     </ods-map>
         * </pre>
         *
         * You can have several layers, each with their own configuration and context:
         *
         * <pre>
         *     <ods-map>
         *         <ods-map-layer context="mycontext" color="#FF0000" display="clusters"></ods-map-layer>
         *         <ods-map-layer context="mycontext2" display="heatmap"></ods-map-layer>
         *         <ods-map-layer context="mycontext3" display="raw" color="#0000FF"></ods-map-layer>
         *     </ods-map>
         * </pre>
         *
         * You can show or hide layers using the `showIf` property, similar to Angular's `ngIf`.
         *
         * <pre>
         *     <ods-map>
         *         <ods-map-layer context="mycontext" color="#FF0000" display="clusters"></ods-map-layer>
         *         <ods-map-layer context="mycontext2" display="heatmap" show-if="showHeatmap"></ods-map-layer>
         *     </ods-map>
         * </pre>
         *
         * Several display modes are available, under two categories: visualization of the data itself (each point is a record),
         * and visualization of an aggregation of data (each point is the result of an aggregation function).
         *
         * - `auto`: depending on the number of points and the type of geometry, the best display mode is automatically chosen. This is the default display
         * mode, and makes sense mot of the time of you want to simply represent geo data.
         * - `raw`: data is downloaded and displayed directly as is, with no clustering or simplification of any kind. Do not
         * use on large (1000+) datasets, as it may freeze the user's browser.
         * - `clusters`: data is aggregated spatially into clusters; each cluster represents two or more "close" points. When at maximum
         * zoom, all points are shown.
         * - `clustersforced`: data is aggregated spatially into clusters, but the number on the cluster is the result of an aggregation function.
         * - `heatmap`: data is displayed as a heatmap; by default it represents the density of points, but it can be the result of an aggregation function.
         * - `aggregation`: data is aggregated based on their geo shape (e.g. two records with the exact same associated shape); by default the color represents
         * the number of aggregated records, but it can be the result of an aggregation function. This mode supports aggregating the context
         * using a join with another context that contains geometrical shapes: use a `joinContext` property, and `localKey` and `remoteKey` to configure
         * the field names of the local and joined datasets; you can also configure one of the fields from the "remote" dataset to be displayed when the mouse
         * hovers the shapes, using `hoverField` and the name of a field.
         *
         * You can specify aggregation functions on display modes that support it (`aggregation`, `heatmap`, `clustersforced`).
         * This is done using two parameters: `function` (AVG for average, MIN for minimum, MAX for maximum, STDDEV for standard deviation,
         * COUNT to count the number of records, SUM for the sum of values), and `expression` to define the value used for the
         * function, usually the name of a field (`expression` is not required when the function is COUNT).
         *
         * <pre>
         *     <ods-map>
         *         <!-- Display a heatmap of the average value -->
         *         <ods-map-layer context="mycontext" display="heatmap" expression="value" function="AVG"></ods-map-layer>
         *     </ods-map>
         * </pre>
         *
         * Apart from `heatmap`, all display modes support color configuration. Three types of configurations are available, depending on the display mode.
         *
         * - `color`: a simple color, as an hex code (#FF0F05) or a simple CSS color name like "red". Available for any mode except `heatmap`.
         * - `colorScale`: the name of a ColorBrewer [http://colorbrewer2.org/] scheme, like "YlGnBu". Available for `aggregation`.
         * - `colorRanges`: a serie of colors and ranges separated by a semicolon, to decide a color depending on a value. For example "red;20;orange;40;#00CE00" to color anything between
         * 20 and 40 in orange, below 20 in red, and above 40 in a custom hex color. Combine with a decimal or integer field name in `colorByField` to configure which field will be
         * used to decide on the color. Available for `raw` and `aggregation`.
         *
         * On top of color configuration, the icon used as a marker on the map can be configured through the `picto`
         * property. The property supports the following keywords:
         * star, circle, bike, bus, train, plane, roadblock, coffee, college, flag, policeman, envelope, restaurant,
         * flower, tree, tree2, tennis, soccer, ski, baby, bed, playground, christianism, judaism, islam, car,
         * wheelchair, recycling, cinema, danger, science, gas-station, anchor, parking, toilets, dog, cross, hospital,
         * drop, music, plus, minus, question, information, wrench, trash, heart, thumbs-up, thumbs-down, check,
         * cross-alt, fire-extinguisher, flame, man, man-alt, woman, glass, beer, house, truck, briefcase, camera,
         * luggage, phone, road, video-game, lightning, trophy, cow, factory, boat, wifi, light, windsurfing, gym,
         * shopping-cart, building, calendar, administration, culture, economy, leaf, justice, health, sport
         *
         *
         * When displaying shapes, you can also use `borderColor` and `opacity` to configure the color of the shape border and the opacity of the shape's fill.
         *
         * If you are displaying data where multiple points or shapes are stacked, you can configure the order in which the items will be
         * displayed in the tooltip, using `tooltipSort` and the name of a field, prefixed by `-` to have a reversed sort.
         * Note: by default, numeric fields are sorted in decreasing order, date and datetime are sorted chronologically, and text fields are sorted
         * alphanumerically.
         *
         * <pre>
         *     <ods-map>
         *         <!-- Reverse sort on 'field' -->
         *         <ods-map-layer context="mycontext" tooltip-sort="-field"></ods-map-layer>
         *     </ods-map>
         * </pre>
         *
         *
         * By default, tooltips show the values associated with a point or shape in a simple template. You can configure your own template by adding
         * HTML inside the `<ods-map-layer></ods-map-layer>` tag. Your template is AngularJS-enabled and will be provided with a `record` object; this object contains
         * a `fields` object with all the values associated with the clicked point or shape.
         *
         * <pre>
         *    <ods-map location="12,48.86167,2.34146">
         *        <ods-map-layer context="mycontext">
         *            <div>my value is: {{record.fields.myvalue}}</div>
         *        </ods-map-layer>
         *    </ods-map>
         * </pre>
         *
         * If your layer is displayed as `raw` or `aggregation`, you can configure a layer so that a click on an item triggers a refine on another context, using `refineOnClickContext`.
         * One or more contexts can be defined:
         * <pre>
         *     <ods-map>
         *         <ods-map-layer context="mycontext" refine-on-click-context="mycontext2"></ods-map-layer>
         *         <ods-map-layer context="mycontext3" refine-on-click-context="[mycontext4, mycontext5]"></ods-map-layer>
         *     </ods-map>
         * </pre>
         *
         * By default, the filter occurs on geometry; for example, clicking on a shape filters the other context on the area.
         * You can also trigger a refine on specific fields; using `refineOnClickMapField` to configure the name of the field to get the value from, and `refineOnClickContextField`
         * to configure the name of the field of the other context to refine on. If you have two or more contexts, you can configure the fields by indicating the context in the
         * name of the property, as `refineOnClick[context]MapField` and `refineOnClick[context]ContextField`.
         *
         * <pre>
         *     <ods-map>
         *         <ods-map-layer context="mycontext" refine-on-click-context="[mycontext, mycontext2]"
         *                                            refine-on-click-mycontext-map-field="field1"
         *                                            refine-on-click-mycontext-context-field="field2"
         *                                            refine-on-click-mycontext2-map-field="field3"
         *                                            refine-on-click-mycontext2-context-field="field4"></ods-map-layer>
         *     </ods-map>
         * </pre>
         *
         * When you first load the map (if there is no `location` parameter), and when your context parameters change, the
         * map is refreshed and moves to fit the content of the new data to display. If you want to exclude a layer's data
         * from the new position's calculation, you can use `excludeFromRefit`:
         *
         * <pre>
         *     <ods-map>
         *         <ods-map-layer context="mycontext"></ods-map-layer>
         *         <ods-map-layer context="mycontext3" exclude-from-refit="true"></ods-map-layer>
         *     </ods-map>
         * </pre>
         */
        return {
            restrict: 'EA',
            scope: {
                context: '=',
                syncToUrl: '@',
                syncToObject: '=',
                location: '@', // Hard-coded location (widget)
                basemap: '@', // Hard-coded basemap (widget),
                staticMap: '@', // Prevent the map to be moved,
                noRefit: '@',
                autoResize: '@',
                toolbarDrawing: '@',
                toolbarGeolocation: '@',
                toolbarFullscreen: '@',
                scrollWheelZoom: '@',
                minZoom: '@',
                maxZoom: '@'
            },
            transclude: true,
            template: '' +
            '<div class="odswidget odswidget-map">' +
            '    <div class="odswidget odswidget-map__map"></div>' +
            '    <div class="odswidget-overlay map odswidget-overlay--opaque" ng-show="initialLoading">' +
            '        <ods-spinner></ods-spinner>' +
            '    </div>' +
            '    <div class="odswidget-map__loading" ng-show="loading">' +
            '        <ods-spinner></ods-spinner>' +
            '    </div>' +
            '    <div ng-transclude></div>' + // Can't find any better solution...
            '</div>',
            link: function(scope, element, attrs) {
                var mapElement = angular.element(element.children()[0]);
                // "Porting" the attributes to the real map.
                if (attrs.id) { mapElement.attr('id', attrs.id); }
                if (attrs.style) { mapElement.attr('style', attrs.style); }
                if (attrs['class']) { mapElement.addClass(attrs['class']); }

                var isStatic = scope.staticMap && scope.staticMap.toLowerCase() === 'true';
                var noRefit = scope.noRefit && scope.noRefit.toLowerCase() === 'true';
                var toolbarDrawing = !(scope.toolbarDrawing && scope.toolbarDrawing.toLowerCase() === 'false');
                var toolbarGeolocation = !(scope.toolbarGeolocation && scope.toolbarGeolocation.toLowerCase() === 'false');
                var toolbarFullscreen = !(scope.toolbarFullscreen && scope.toolbarFullscreen.toLowerCase() === 'false');

                if (scope.context) {
                    // Handle the view defined on the map tag directly
                    var group = MapHelper.MapConfiguration.createLayerGroupConfiguration();
                    var layer = MapHelper.MapConfiguration.createLayerConfiguration();
                    group.activeDatasets.push(layer);
                    scope.mapConfig.layers.push(group);

                    layer.context = scope.context;

                    // FIXME: Factorize the same code with odsLayerGroup
                    scope.context.wait().then(function (nv) {
                        if (nv) {
                            if (layer.context.dataset.getExtraMeta('visualization', 'map_marker_hidemarkershape') !== null) {
                                layer.marker = !layer.context.dataset.getExtraMeta('visualization', 'map_marker_hidemarkershape');
                            } else {
                                layer.marker = true;
                            }

                            layer.color = layer.context.dataset.getExtraMeta('visualization', 'map_marker_color') || "#C32D1C";
                            layer.picto = layer.context.dataset.getExtraMeta('visualization', 'map_marker_picto') || (layer.marker ? "circle" : "dot");
                        }
                    });
                }

                function resizeMap() {
                    var mapElement = $('.odswidget-map__map');
                    if (scope.autoResize === 'true' && mapElement.length > 0) {
                        // Only do this if visible
                        var height = Math.max(200, $(window).height() - mapElement.offset().top);
                        mapElement.height(height);
                    }
                }

                if (scope.autoResize === 'true') {
                    $(window).on('resize', resizeMap);
                    resizeMap();
                }

                /* INITIALISATION AND DEFAULT VALUES */
                scope.initialLoading = true;


                if (scope.syncToObject) {
                    scope.mapContext = scope.syncToObject;
                } else {
                    scope.mapContext = {};
                }

                if (scope.syncToUrl === 'true') {
                    // We can't safely have more than one addSynchronizedObject so we target explicitely what we want,
                    // because the context could also use addSynchronizedObject
                    URLSynchronizer.addSynchronizedValue(scope, 'mapContext.location', 'location', true);
                    URLSynchronizer.addSynchronizedValue(scope, 'mapContext.basemap', 'basemap');
                }

                if (scope.location) {
                    scope.mapContext.location = scope.mapContext.location || scope.location;
                }
                if (scope.basemap) {
                    scope.mapContext.basemap = scope.mapContext.basemap || scope.basemap;
                }

                /* END OF INITIALISATION */

                ModuleLazyLoader('leaflet').then(function() {
                    // Initializing the map
                    var mapOptions = {
                        basemapsList: ODSWidgetsConfig.basemaps,
                        worldCopyJump: true,
                        minZoom: 2,
                        basemap: scope.mapContext.basemap,
                        dragging: !isStatic,
                        keyboard: !isStatic,
                        prependAttribution: ODSWidgetsConfig.mapPrependAttribution,
                        maxBounds: [[-90, -180], [90, 180]],
                        zoomControl: false,
                        scrollWheelZoom: scope.scrollWheelZoom !== 'false'
                    };

                    if (scope.minZoom) {
                        mapOptions.minZoom = scope.minZoom;
                    }
                    if (scope.maxZoom) {
                        mapOptions.maxZoom = scope.maxZoom;
                    }

                    if (isStatic) {
                        mapOptions.doubleClickZoom = false;
                        mapOptions.scrollWheelZoom = false;
                    }

                    resizeMap();

                    var map = new L.ODSMap(element.children()[0].children[0], mapOptions);

//                    map.setView(new L.LatLng(48.8567, 2.3508),13);
                    map.addControl(new L.Control.Scale());

                    if (!isStatic) {
                        map.addControl(new L.Control.Zoom({
                            zoomInTitle: translate('Zoom in'),
                            zoomOutTitle: translate('Zoom out')
                        }));
                    }

                    if (toolbarFullscreen) {
                        // Only add the Fullscreen control if we are not in an iframe, as it is blocked by browsers
                        try {
                            if (window.self === window.top) {
                                // We are NOT in an iframe
                                map.addControl(new L.Control.Fullscreen({
                                    title: {
                                        'false': translate('View Fullscreen'),
                                        'true': translate('Exit Fullscreen')
                                    }
                                }));
                            }
                        } catch (e) {
                            // We are in an iframe
                        }
                    }


                    if (ODSWidgetsConfig.mapGeobox && !isStatic) {
                        var geocoder = L.Control.geocoder({
                            placeholder: translate('Find a place...'),
                            errorMessage: translate('Nothing found.'),
                            geocoder: new L.Control.Geocoder.Nominatim({serviceUrl: "https://nominatim.openstreetmap.org/", geocodingQueryParams: {"accept-language": ODSWidgetsConfig.language || 'en', "polygon_geojson": true}})
                        });
                        geocoder.markGeocode = function(result) {
                            map.fitBounds(result.bbox);

                            if (result.properties.geojson) {
                                var highlight = L.geoJson(result.properties.geojson, {
                                    style: function () {
                                        return {
                                            opacity: 0,
                                            fillOpacity: 0.8,
                                            fillColor: 'orange',
                                            className: 'leaflet-geocoder-highlight'
                                        };
                                    }
                                });
                                map.addLayer(highlight);
                                $timeout(function () {
                                    element.addClass('geocoder-highlight-on');
                                }, 0);
                                $timeout(function () {
                                    element.removeClass('geocoder-highlight-on');
                                    map.removeLayer(highlight);
                                }, 2500);
                            }
                        };
                        map.addControl(geocoder);
                    }

                    if (toolbarGeolocation && !isStatic) {
                        map.addControl(new L.Control.Locate({
                            maxZoom: 18,
                            strings: {
                                title: translate("Show me where I am"),
                                popup: translate("You are within {distance} {unit} from this point"),
                                outsideMapBoundsMsg: translate("You seem located outside the boundaries of the map")
                            }
                        }));
                    }

                    // Drawing
                    scope.drawnItems = new L.FeatureGroup(); // Necessary to show geofilters
                    map.addLayer(scope.drawnItems);

                    if (toolbarDrawing && !isStatic) {
                        // Localize all the messages
                        L.drawLocal.draw.toolbar.buttons.circle = translate('Draw a circle to filter on');
                        L.drawLocal.draw.toolbar.buttons.polygon = translate('Draw a polygon to filter on');
                        L.drawLocal.draw.toolbar.buttons.rectangle = translate('Draw a rectangle to filter on');
                        L.drawLocal.draw.toolbar.actions = {
                            title: translate('Cancel area filter'),
                            text: translate('Cancel')
                        };
                        L.drawLocal.draw.toolbar.undo = {
                            title: translate('Delete last point'),
                            text: translate('Delete last point')
                        };
                        L.drawLocal.edit.toolbar.buttons = {
                            edit: translate('Edit area filter.'),
                            editDisabled: translate('No area filter to edit.'),
                            remove: translate('Delete area filter.'),
                            removeDisabled: translate('No area filter to delete.')
                        };
                        L.drawLocal.edit.toolbar.actions = {
                            save: {
                                title: translate('Save changes.'),
                                text: translate('Save')
                            },
                            cancel: {
                                title: translate('Cancel editing, discards all changes.'),
                                text: translate('Cancel')
                            }
                        };

                        var drawControl = new L.Control.Draw({
                            edit: {
                                featureGroup: scope.drawnItems
                            },
                            draw: {
                                polyline: false,
                                marker: false
                            }
                        });
                        map.addControl(drawControl);
                    }

                    scope.map = map;

                    // Now that the map is ready, we need to know where to set the map first
                    // - If there is an explicit location, use it. This includes older legacy parameters and formats
                    // - Else, we deduce it from the displayed datasets
                    var setInitialMapView = function(location) {
                        var deferred = $q.defer();

                        if (location) {
                            var loc = MapHelper.getLocationStructure(location);
                            scope.map.setView(loc.center, loc.zoom);
                            waitForVisibleContexts().then(function() {
                                refreshData(false);
                            });

                            deferred.resolve();
                        } else {
                            waitForVisibleContexts().then(function() {
                                MapHelper.retrieveBounds(MapHelper.MapConfiguration.getActiveContextList(scope.mapConfig, {geoOnly: true, skipExcludedFromRefit: true})).then(function (bounds) {
                                    // Fit to dataset boundingbox if there is no viewport or geofilter
                                    if (bounds) {
                                        scope.map.fitBounds(bounds);
                                    } else {
                                        var loc = MapHelper.getLocationStructure(ODSWidgetsConfig.defaultMapLocation);
                                        scope.map.setView(loc.center, loc.zoom);
                                    }
                                    refreshData(false);

                                    deferred.resolve();
                                });
                            });
                        }

                        return deferred.promise;
                    };

                    setInitialMapView(scope.mapContext.location).then(function() {
                        scope.initialLoading = false;
                        onViewportMove(scope.map);

                        if (!isStatic) {
                            // Initialize all the drawing support events
                            waitForVisibleContexts().then(initDrawingTools);
                        }

                        scope.map.on('moveend', function(e) {
                            // Whenever the map moves, we update the displayed data
                            scope.$apply(function() {
                                onViewportMove(e.target);
                            });
                        });

                        // Refresh events
                        scope.$watch('mapContext.location', function(nv, ov) {
                            if (nv !== ov) {
                                // When the location changes, triggers a data refresh.
                                // We could do it in the moveend event instead of watching the location, but that way we ensure that
                                // if something else from outside changes the location, we react as well.
                                refreshData(false, true);
                            }
                        });

                        // INitialize watcher
                        scope.$watch(function() {
                            var pending = 0;
                            angular.forEach(scope.mapConfig.layers, function(groupConfig) {
                                angular.forEach(groupConfig.activeDatasets, function(layerConfig) {
                                    if (layerConfig.loading) {
                                        pending++;
                                    }
                                });
                            });
                            return pending;
                        }, function(nv) {
                            scope.loading = !!nv;
                        });

                        // Initialize data watchers
                        // TODO: Make the contexts broadcast an event when the parameters change? Will spare
                        // a potentially heavy watch.
                        scope.$watch(function() {
                            // We create a second param list with all the parameters that should trigger a refit, so that
                            // we can check if it changed before triggering a refit.
                            var params = [],
                                paramsNoRefit = [];
                            angular.forEach(MapHelper.MapConfiguration.getActiveContextList(scope.mapConfig), function(ctx) {
                                params.push([ctx.name, ctx.parameters]);
                            });
                            angular.forEach(MapHelper.MapConfiguration.getActiveContextList(scope.mapConfig, {skipExcludedFromRefit: true}), function(ctx) {
                                paramsNoRefit.push([ctx.name, ctx.parameters]);
                            });
                            return [params, paramsNoRefit];
                        }, function(nv, ov) {
                            if (nv !== ov) {
                                // Refresh with a refit
                                syncGeofilterToDrawing();
                                refreshData(!angular.equals(nv[1], ov[1]));
                            }
                        }, true);
                    });

                    if (ODSWidgetsConfig.basemaps.length > 1) {
                        scope.map.on('baselayerchange', function (e) {
                            scope.$evalAsync('mapContext.basemap = "'+e.layer.basemapId+'"');


                            // The bundle layer zooms have to be the same as the basemap, else it will drive the map
                            // to be zoomable beyond the basemap levels
                            angular.forEach(scope.mapConfig.layers, function(groupConfig) {
                                if (groupConfig.displayed) {
                                    angular.forEach(groupConfig.activeDatasets, function (layerConfig) {
                                        if (layerConfig.clusterMode === 'tiles' && layerConfig.rendered) {
                                            layerConfig.rendered.setMinZoom(e.layer.options.minZoom);
                                            layerConfig.rendered.setMaxZoom(e.layer.options.maxZoom);
                                        }
                                    });
                                }
                            });
                        });
                    }

                    var onViewportMove = function(map) {
                        var size = map.getSize();
                        if (size.x > 0 && size.y > 0) {
                            // Don't attempt to do anything if the map is not displayed... we can't capture useful bounds
                            scope.mapContext.location = MapHelper.getLocationParameter(map.getCenter(), map.getZoom());
                        }
                    };

                    var refreshData = function(fitView, locationChangedOnly) {
                        /* Used when one of the context changes, or the viewport changes: triggers a refresh of the displayed data
                           If "fitView" is true, then the map moves to the new bounding box containing all the data, before
                           beginning to render the result.

                           dataUnchanged means only the location changed, and some layers don't need a refresh at all (tiles, or
                           layers that load all at once)
                         */
                        fitView = !noRefit && fitView;
                        var renderData = function(locationChangedOnly) {
                            var promises = [];
                            angular.forEach(scope.mapConfig.layers, function(layerGroup) {
                                if (!layerGroup.displayed) {
                                    angular.forEach(layerGroup.activeDatasets, function(layer) {
                                        if (layer.rendered) {
                                            scope.map.removeLayer(layer.rendered);
                                            layer.rendered = null;
                                        }
                                    });
                                    return;
                                }
                                angular.forEach(layerGroup.activeDatasets, function(layer) {
                                    // Depending on the layer config, we can opt for various representations

                                    // Tiles: call a method on the existing layer
                                    // Client-side: build a new layer and remove the old one
                                    if (!locationChangedOnly || MapLayerRenderer.doesLayerRefreshOnLocationChange(layer)) {
                                        promises.push(MapLayerRenderer.updateDataLayer(layer, scope.map));
                                    }
                                });
                            });
                            $q.all(promises).then(function() {
                                // We got them all
                                // FIXME: Do we have something to do here?
                            });
                        };

                        if (fitView) {
                            // Move the viewport to the new location, and change the tile
                            MapHelper.retrieveBounds(MapHelper.MapConfiguration.getActiveContextList(scope.mapConfig, {geoOnly: true, skipExcludedFromRefit: true})).then(function(bounds) {
                                if (bounds && bounds !== MapHelper.WORLD_BOUNDS) {
                                    // Until $applyAsync... Make sure the fitting is done outside this digest cycle,
                                    // so that the triggering of viewport move doesn't clash with it
                                    $timeout(function() {
                                        var before = scope.map.getBounds().toBBoxString();
                                        scope.map.fitBounds(bounds);
                                        var after = scope.map.getBounds().toBBoxString();

                                        if (before === after) {
                                            // The map didn't move, so we can't rely on the location change to trigger a refresh
                                            refreshData(false, true);
                                        }
                                    }, 0);
                                } else {
                                    renderData(locationChangedOnly);
                                }
                            });
                        } else {
                            renderData();
                        }
                    };

                    var initDrawingTools = function() {
                        // Make sure we know when the user is drawing, so that we can ignore other interactions (click on
                        // shapes...)
                        scope.map.on('draw:drawstart draw:editstart', function() {
                            scope.map.isDrawing = true;
                        });
                        scope.map.on('draw:drawstop draw:editstop', function() {
                            scope.map.isDrawing = false;
                        });

                        // Set the drawn items as clickable when in deletion mode. We have to do it manually because
                        // we are redrawing our own shapes (due to parameter sync on init) instead of using the leaflet-draw builtint.
                        var setLayerInteractive = function(layer) {
                            layer._path.setAttribute('style','cursor: pointer; pointer-events: auto;');
                        };
                        var setLayerNonInteractive = function(layer) {
                            layer._path.setAttribute('style','cursor: auto; pointer-events: none;');
                        };

                        scope.map.on('draw:deletestart', function() {
                            setLayerInteractive(scope.drawnItems.getLayers()[0]);
                        });

                        scope.map.on('draw:deleteend', function() {
                            setLayerNonInteractive(scope.drawnItems.getLayers()[0]);
                        });

                        // Applying drawing effects on contexts
                        scope.map.on('draw:created', function (e) {
                            var layer = e.layer;
                            if (scope.drawnItems.getLayers().length > 0) {
                                scope.drawnItems.removeLayer(scope.drawnItems.getLayers()[0]);
                            }
                            scope.drawnItems.addLayer(layer);

                            // Apply to parameters
                            applyDrawnLayer(layer, e.layerType);

                            scope.$apply();
                        });

                        scope.map.on('draw:edited', function(e) {
                            var layer = e.layers.getLayers()[0];
                            var type = getDrawnLayerType(layer);

                            applyDrawnLayer(layer, type);
                            scope.$apply();
                        });

                        scope.map.on('draw:deleted', function() {
                            delete scope.mapConfig.drawnArea;
                            scope.$apply();
                        });

                        var applyDrawnLayer = function(layer, type) {
                            if (type === 'circle') {
                                var distance = layer.getRadius();
                                var center = layer.getLatLng();
                                scope.mapConfig.drawnArea = {
                                    'shape': 'circle',
                                    'coordinates': center.lat + ',' + center.lng + ',' + distance
                                };
                            } else {
                                // Compute the polygon
                                var geoJson = layer.toGeoJSON();
                                var path = ODS.GeoFilter.getGeoJSONPolygonAsPolygonParameter(geoJson.geometry);
                                scope.mapConfig.drawnArea = {
                                    'shape': 'polygon',
                                    'coordinates': path
                                };
                            }
                        };

                        var getDrawnLayerType = function(layer) {
                            if (angular.isDefined(layer.getRadius)) {
                                return 'circle';
                            } else {
                                return 'polygon';
                            }
                        };

                        var drawableStyle = {
                            color: '#2ca25f',
                            fillOpacity: 0.2,
                            opacity: 0.8,
                            clickable: true
                        };

                        scope.$watch('mapConfig.drawnArea', function(nv) {
                            // Wipe the current drawn polygon
                            if (scope.drawnItems.getLayers().length > 0) {
                                scope.drawnItems.removeLayer(scope.drawnItems.getLayers()[0]);
                            }

                            // Draw
                            var drawn;
                            if (nv) {
                                if (nv.shape === 'polygon') {
                                    // FIXME: maybe a cleaner way than using GeoJSON, but it felt weird adding a method
                                    // just to output a Leaflet-compatible arbitrary format. Still, we should do it.
                                    var geojson = ODS.GeoFilter.getPolygonParameterAsGeoJSON(nv.coordinates);
                                    var coordinates = geojson.coordinates[0];
                                    coordinates.splice(geojson.coordinates[0].length - 1, 1);
                                    var i, coords, swap;
                                    for (i = 0; i < coordinates.length; i++) {
                                        coords = coordinates[i];
                                        swap = coords[0];
                                        coords[0] = coords[1];
                                        coords[1] = swap;
                                    }
                                    if (coordinates.length === 4 &&
                                        coordinates[0][0] === coordinates[3][0] &&
                                        coordinates[1][0] === coordinates[2][0] &&
                                        coordinates[0][1] === coordinates[1][1] &&
                                        coordinates[2][1] === coordinates[3][1]) {
                                        drawn = new L.Rectangle(coordinates, drawableStyle);
                                    } else {
                                        drawn = new L.Polygon(coordinates, drawableStyle);
                                    }
                                    //drawn = new L.GeoJSON(geojson);
                                } else if (nv.shape === 'circle') {
                                    var parts = nv.coordinates.split(',');
                                    var lat = parts[0],
                                        lng = parts[1],
                                        radius = parts[2];
                                    drawn = new L.Circle([lat, lng], radius, drawableStyle);
                                }

                                if (drawn) {
                                    scope.drawnItems.addLayer(drawn);
                                    setLayerNonInteractive(scope.drawnItems.getLayers()[0]);
                                }
                            }

                            // Apply to every context available
                            angular.forEach(MapHelper.MapConfiguration.getActiveContextList(scope.mapConfig, {geoOnly: true}), function(ctx) {
                                if (nv) {
                                    // There is something to apply
                                    if (nv.shape === 'circle') {
                                        ctx.parameters['geofilter.distance'] = nv.coordinates;
                                        delete ctx.parameters['geofilter.polygon'];
                                    } else if (nv.shape === 'polygon') {
                                        ctx.parameters['geofilter.polygon'] = nv.coordinates;
                                        delete ctx.parameters['geofilter.distance'];
                                    }
                                } else {
                                    // Remove the filters
                                    delete ctx.parameters['geofilter.polygon'];
                                    delete ctx.parameters['geofilter.distance'];
                                }
                            });

                        }, true);
                    };
                });

                var waitForVisibleContexts = function() {
                    var deferred = $q.defer();

                    // Watches all the active contexts, and resolves once they are ready
                    // FIXME: Include joinContexts and refineOnClickContexts
                    var contexts = MapHelper.MapConfiguration.getActiveContextList(scope.mapConfig);
                    var promises = contexts.map(function(context) { return context.wait(); });
                    $q.all(promises).then(function() {
                        syncGeofilterToDrawing();
                        deferred.resolve();
                    });

                    return deferred.promise;
                };

                var syncGeofilterToDrawing = function() {
                    // Check if there are geofilters shared by everyone at init time, and if so, synchronize the
                    // drawn shapes to match them.
                    var polygon, distance;
                    angular.forEach(MapHelper.MapConfiguration.getActiveContextList(scope.mapConfig, {geoOnly: true}), function(context) {
                        if (angular.isUndefined(polygon) && angular.isUndefined(polygon)) {
                            // First time
                            polygon = context.parameters['geofilter.polygon'];
                            distance = context.parameters['geofilter.distance'];
                        } else {
                            if (polygon !== context.parameters['geofilter.polygon']) {
                                polygon = null;
                            }
                            if (distance !== context.parameters['geofilter.distance']) {
                                distance = null;
                            }
                        }
                    });
                    if (polygon) {
                        scope.mapConfig.drawnArea = {
                            shape: 'polygon',
                            coordinates: polygon
                        };
                    } else if (distance) {
                        scope.mapConfig.drawnArea = {
                            shape: 'circle',
                            coordinates: distance
                        };
                    } else {
                        scope.mapConfig.drawnArea = {};
                    }
                };

                // TODO: Plug polygon drawing to the geofilter.polygon of every context. Possibly store it in a specific
                // place in the map config, so we know which one to use when loading the map

            },
            controller: ['$scope', function($scope) {
                $scope.mapConfig = {
                    'layers': []
                };
                //
                this.registerLayer = function(layer) {
                    // Register with a dummy single-layer-group
                    var group = MapHelper.MapConfiguration.createLayerGroupConfiguration();
                    group.activeDatasets.push(layer);
                    $scope.mapConfig.layers.push(group);
                    return group;
                };

                this.registerLayerGroup = function(layer) {
                    $scope.mapConfig.layers.push(layer);
                };
            }]
        };
    }]);

    mod.directive('odsMapLayerGroup', function() {
        // TODO: Plug for real
        return {
            restrict: 'EA',
            scope: {},
            require: '^odsMap',
            link: function(scope, element, attrs, mapCtrl) {
                mapCtrl.registerLayerGroup(scope.group);
            },
            controller: ['$scope', function($scope) {
                $scope.group = {'activeDatasets': []};

                this.registerLayer = function(obj) {
                    // Register to the group
                    $scope.group.activeDatasets.push(obj);
                    return $scope.group;
                };
            }]
        };
    });

    mod.directive('odsMapLayer', ['MapHelper', function(MapHelper) {
        return {
            restrict: 'EA',
            scope: {
                context: '=',
                showIf: '=',
                color: '@',
                borderColor: '@',
                opacity: '@',
                colorScale: '@',
                colorRanges: '@',
                colorByField: '@',
                picto: '@',
                showMarker: '@',
                display: '@',
                'function': '@', // A less risky name?
                expression: '@',

                tooltipSort: '@',
                hoverField: '@',

                refineOnClickContext: '=',

                joinContext: '=',
                localKey: '@',
                remoteKey: '@',

                excludeFromRefit: '=?'
            },
            template: function(tElement) {
                var tpl = '';
                tElement.contents().wrapAll('<div>');
                if (tElement.contents().length > 0 && tElement.contents().html().trim().length > 0) {
                    tElement.contents().wrapAll('<div>');
                    tpl = tElement.children().html();
                }
                // Yes, it seems highly weird, but unfortunately it sems to be the only option as we want to get the
                // original content BEFORE compile, and pass it to the link function.
                return '<div tooltiptemplate="'+tpl.replace(/"/g, '&quot;')+'"></div>';
            },
            require: ['?^odsMapLayerGroup', '^odsMap'],
            link: function(scope, element, attrs, controllers) {
                var layerGroupCtrl  = controllers[0],
                    mapCtrl         = controllers[1];
                var tplHolder = angular.element(element.children()[0]);
                var customTemplate = tplHolder.attr('tooltiptemplate');

                var color;
                if (scope.color) {
                    color = scope.color;
                } else if (scope.colorScale) {
                    color = {
                        type: 'scale',
                        scale: scope.colorScale
                    };
                } else if (scope.colorRanges) {
                    var tokens = scope.colorRanges.split(';');
                    var ranges = tokens.filter(function(elt, idx) { return idx % 2 === 1; });
                    var colors = tokens.filter(function(elt, idx) { return idx % 2 === 0; });
                    color = {
                        type: 'range',
                        ranges: ranges,
                        colors: colors,
                        field: scope.colorByField
                    };
                }

                var config = {
                    'color': color,
                    'borderColor': scope.borderColor,
                    'opacity': scope.opacity,
                    'picto': scope.picto,
                    'display': scope.display,
                    'function': scope['function'],
                    'expression': scope.expression,
                    'localKey': scope.localKey,
                    'remoteKey': scope.remoteKey,
                    'tooltipSort': scope.tooltipSort,
                    'hoverField': scope.hoverField,
                    'excludeFromRefit': scope.excludeFromRefit
                };
                var layer = MapHelper.MapConfiguration.createLayerConfiguration(customTemplate, config);
                var layerGroup;
                if (layerGroupCtrl) {
                    // Register to the group
                    layerGroup = layerGroupCtrl.registerLayer(layer);
                } else {
                    // Register to the map
                    layerGroup = mapCtrl.registerLayer(layer);
                }

                if (attrs.showIf) {
                    scope.$watch('showIf', function(nv, ov) {
                        layerGroup.displayed = nv;
                    });
                }

                var unwatch = scope.$watch('context', function(nv) {
                    if (nv) {
                        layer.context = nv;
                        nv.wait().then(function() {
                            if (scope.showMarker) {
                                layer.marker = (scope.showMarker.toLowerCase() === 'true');
                            } else if (layer.context.dataset.getExtraMeta('visualization', 'map_marker_hidemarkershape') !== null) {
                                layer.marker = !layer.context.dataset.getExtraMeta('visualization', 'map_marker_hidemarkershape');
                            } else {
                                layer.marker = true;
                            }

                            layer.color = layer.color || layer.context.dataset.getExtraMeta('visualization', 'map_marker_color') || "#C32D1C";
                            layer.picto = layer.picto || layer.context.dataset.getExtraMeta('visualization', 'map_marker_picto') || (layer.marker ? "circle" : "dot");
                        });
                        unwatch();
                    }
                });

                var unwatchJoinContext = scope.$watch('joinContext', function(nv) {
                    if (nv) {
                        layer.joinContext = nv;
                        unwatchJoinContext();
                    }
                });

                var unwatchRefineOnClick = scope.$watch('refineOnClickContext', function(nv) {
                    if (angular.isArray(nv)) {
                        // Check that all contexts are defined
                        var allDefined = true;
                        angular.forEach(nv, function(ctx) {
                            allDefined = allDefined && angular.isDefined(ctx);
                        });
                        if (!allDefined) {
                            return;
                        }

                    } else if (!nv) {
                        return;
                    }

                    layer.refineOnClick = [];
                    var contexts = angular.isArray(nv) && nv || [nv];
                    angular.forEach(contexts, function(ctx) {
                        var replaceRefine = false;
                        var attrname = 'refineOnClick' + ODS.StringUtils.capitalize(ctx.name);
                        if (angular.isDefined(attrs[attrname + 'ReplaceRefine'])) {
                            if (attrs[attrname + 'ReplaceRefine'] !== 'false') {
                                replaceRefine = true;
                            }
                        } else if (angular.isDefined(attrs.refineOnClickReplaceRefine)) {
                            if (attrs.refineOnClickReplaceRefine !== 'false') {
                                replaceRefine = true;
                            }
                        }
                        layer.refineOnClick.push({
                            context: ctx,
                            mapField: attrs[attrname + 'MapField'] || attrs.refineOnClickMapField,
                            contextField: attrs[attrname + 'ContextField'] || attrs.refineOnClickContextField,
                            replaceRefine: replaceRefine
                        });
                        unwatchRefineOnClick();
                    });
                });
            },
            controller: ['$scope', function($scope) {
            }]
        };
    }]);

    mod.directive('odsMapTooltip', ['$compile', '$templateCache', function($compile, $templateCache) {
        return {
            restrict: 'E',
            transclude: true,
            template: '' +
                '<div class="odswidget-map-tooltip">' +
                '   <ods-spinner class="odswidget-map-tooltip__spinner" ng-hide="records"></ods-spinner>' +
                '   <h2 ng-show="records.length > 1" class="odswidget-map-tooltip__scroll-control ng-leaflet-tooltip-cloak">' +
                '       <i class="odswidget-map-tooltip__scroll-left fa fa-chevron-left" ng-click="moveIndex(-1)"></i>' +
                '       <span ng-bind="(selectedIndex+1)+\'/\'+records.length" ng-click="moveIndex(1)"></span>' +
                '       <i class="odswidget-map-tooltip__scroll-right fa fa-chevron-right" ng-click="moveIndex(1)"></i>' +
                '   </h2>' +
                '   <div class="ng-leaflet-tooltip-cloak odswidget-map-tooltip__limited-results-warning" ng-show="records && records.length == RECORD_LIMIT" translate>(limited to the first {{RECORD_LIMIT}} records)</div>' +
                '   <div ng-repeat="record in records" ng-show="$index == selectedIndex" class="odswidget-map-tooltip__record">' +
                '       <div ng-if="!template" ng-include src="\'default-tooltip\'"></div>' +
                '       <div ng-if="template" ng-include src="\'custom-tooltip-\'+context.dataset.datasetid"></div>' +
                '   </div>' +
                '</div>',
            scope: {
                shape: '=',
                context: '=',
                recordid: '=',
                map: '=',
                template: '@',
                gridData: '=',
                geoDigest: '@',
                tooltipSort: '@' // field or -field
            },
            replace: true,
            link: function(scope, element, attrs) {
                var destroyPopup = function(e) {
                    if (e.popup._content === element[0]) {
                        if (scope.selectedShapeLayer) {
                            // Remove the outline on the selected shape
                            scope.map.removeLayer(scope.selectedShapeLayer);
                        }
                        scope.map.off('popupclose', destroyPopup);
                        scope.$destroy();
                    }
                };
                scope.map.on('popupclose', destroyPopup);
                scope.unCloak = function() {
                    jQuery('.ng-leaflet-tooltip-cloak', element).removeClass('ng-leaflet-tooltip-cloak');
                };
                if (attrs.template && attrs.template !== '') {
                    $templateCache.put('custom-tooltip-' + scope.context.dataset.datasetid, attrs.template);
                } else {
                    $templateCache.put('default-tooltip', '<div class="infoPaneLayout">' +
                        '<h2 class="odswidget-map-tooltip__header" ng-show="!!getTitle(record)" ng-bind="getTitle(record)"></h2>' +
                        '<dl class="odswidget-map-tooltip__record-values">' +
                        '    <dt ng-repeat-start="field in context.dataset.fields|fieldsForVisualization:\'map\'|fieldsFilter:context.dataset.extra_metas.visualization.map_tooltip_fields" ' +
                        '        ng-show="record.fields[field.name]|isDefined"' +
                        '        class="odswidget-map-tooltip__field-name">' +
                        '        {{ field.label }}' +
                        '    </dt>' +
                        '    <dd ng-repeat-end ' +
                        '        ng-switch="field.type" ' +
                        '        ng-show="record.fields[field.name]|isDefined"' +
                        '        class="odswidget-map-tooltip__field-value">' +
                        '        <span ng-switch-when="geo_point_2d">' +
                        '            <ods-geotooltip width="300" height="300" coords="record.fields[field.name]">{{ record.fields|formatFieldValue:field }}</ods-geotooltip>' +
                        '        </span>' +
                        '        <span ng-switch-when="geo_shape">' +
                        '            <ods-geotooltip width="300" height="300" geojson="record.fields[field.name]">{{ record.fields|formatFieldValue:field }}</ods-geotooltip>' +
                        '        </span>' +
                        '        <span ng-switch-when="file">' +
                        '            <div ng-if="!context.dataset.isFieldAnnotated(field, \'has_thumbnails\')" ng-bind-html="record.fields|formatFieldValue:field"></div>' +
                        '            <div ng-if="context.dataset.isFieldAnnotated(field, \'has_thumbnails\')" ng-bind-html="record.fields[field.name]|displayImageValue:context.dataset.datasetid" style="text-align: center;"></div>' +
                        '        </span>' +
                        '        <span ng-switch-default title="{{record.fields|formatFieldValue:field}}" ng-bind-html="record.fields|formatFieldValue:field|imagify|videoify|prettyText|nofollow"></span>' +
                        '    </dd>' +
                        '</dl>' +
                    '</div>');
                }

            },
            controller: ['$scope', '$filter', 'ODSAPI', function($scope, $filter, ODSAPI) {
                $scope.RECORD_LIMIT = 100;
                $scope.records = [];
                $scope.selectedIndex = 0;


                var tooltipSort = $scope.tooltipSort;
                if (!tooltipSort && $scope.context.dataset.getExtraMeta('visualization', 'map_tooltip_sort_field')) {
                    tooltipSort = ($scope.context.dataset.getExtraMeta('visualization', 'map_tooltip_sort_direction') || '') + $scope.context.dataset.getExtraMeta('visualization', 'map_tooltip_sort_field');
                }

                $scope.moveIndex = function(amount) {
                    var newIndex = ($scope.selectedIndex + amount) % $scope.records.length;
                    if (newIndex < 0) {
                        newIndex = $scope.records.length + newIndex;
                    }
                    $scope.selectedIndex = newIndex;
                };

                var refresh = function() {
                    var options = {
                        format: 'json',
                        rows: $scope.RECORD_LIMIT
                    };
                    var shapeType = null;
                    if ($scope.shape) {
                        shapeType = $scope.shape.type;
                    }
                    if ($scope.recordid && shapeType !== 'Point') {
                        // When we click on a point, we rather want to match the location so that it fetches the other points
                        // stacked on the same place
                        options.q = "recordid:'"+$scope.recordid+"'";
                    } else if ($scope.geoDigest) {
                        options.geo_digest = $scope.geoDigest;
                    } else if ($scope.gridData) {
                        // From an UTFGrid tile
                        if ($scope.gridData['ods:geo_grid'] !== null) {
                            // Request geo_grid
                            options.geo_grid = $scope.gridData['ods:geo_grid'];
                        } else {
                            // Request geo_hash
                            options.geo_digest = $scope.gridData['ods:geo_digest'];
                        }
                    } else if ($scope.shape) {
                        ODS.GeoFilter.addGeoFilterFromSpatialObject(options, $scope.shape);
                    }

                    var queryOptions = {};
                    angular.extend(queryOptions, $scope.context.parameters, options);

                    if (tooltipSort) {
                        queryOptions.sort = tooltipSort;
                        ODSAPI.records.search($scope.context, queryOptions).success(function(data) { handleResults(data.records); });
                    } else {
                        ODSAPI.records.download($scope.context, queryOptions).success(handleResults);
                    }

                    function handleResults(data) {
                        if (data.length > 0) {
                            $scope.selectedIndex = 0;
                            $scope.records = data;
                            $scope.unCloak();
                            var shapeFields = $scope.context.dataset.getFieldsForType('geo_shape');
                            var shapeField;
                            if (shapeFields.length) {
                                shapeField = shapeFields[0].name;
                            }
                            if (shapeField && $scope.gridData &&
                                ($scope.gridData['ods:geo_type'] === 'Polygon' ||
                                 $scope.gridData['ods:geo_type'] === 'LineString' ||
                                 $scope.gridData['ods:geo_type'] === 'MultiPolygon' ||
                                 $scope.gridData['ods:geo_type'] === 'MultiLineString'
                                )) {
                                // Highlight the selected polygon
                                var record = data[0];
                                if (record.fields[shapeField]) {
                                    var geojson = record.fields[shapeField];
                                    if (geojson.type !== 'Point') {
                                        $scope.selectedShapeLayer = L.geoJson(geojson, {
                                            fill: false,
                                            color: '#CC0000',
                                            opacity: 1,
                                            dashArray: [5],
                                            weight: 2

                                        });
                                        $scope.map.addLayer($scope.selectedShapeLayer);
                                    }
                                }
                            }
                        } else {
                            $scope.map.closePopup();
                        }
                    }
                };

                $scope.$watch('context.parameters', function() {
                    refresh();
                }, true);
                $scope.$apply();

                /* *** HELPER METHODS FOR THE TEMPLATES *** */
                $scope.getTitle = function(record) {
                    if ($scope.context.dataset.extra_metas && $scope.context.dataset.extra_metas.visualization && $scope.context.dataset.extra_metas.visualization.map_tooltip_title) {
                        var titleField = $scope.context.dataset.extra_metas.visualization.map_tooltip_title;
                        if (angular.isDefined(record.fields[titleField]) && record.fields[titleField] !== '') {
                            return record.fields[titleField];
                        }
                    }
                    return null;
                };
                $scope.fields = angular.copy($scope.context.dataset.fields);
            }]
        };
    }]);

}());;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsMediaGallery', ['$timeout', function($timeout) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsMediaGallery
         * @restrict E
         * @scope
         * @param {DatasetContext} context {@link ods-widgets.directive:odsDatasetContext Dataset Context} to use
         * @param {string} [displayedFields=all] A comma-separated list of fields to display in the details for each thumbnail. If no value is specified, the options configured for the dataset are used or all fields if nothing configured.
         * @param {string} [imageFields=all] A comma-separated list of fields to display in the gallery as thumbnails. If no value is specified, the options configured for the dataset are used or all media fields if nothing configured.
         * @param {string} [displayMode=compact] Specify the layout of the gallery. Accepted values are: compact, large. In compact mode, the images are fitted together on each lines giving coherent lines. In large mode, the images are given more space and less constrained in height.
         * @param {string} [odsWidgetTooltip] {@link ods-widgets.directive:odsWidgetTooltip Widget Tooltip}
         * @param {boolean} [odsAutoResize] see {@link ods-widgets.directive:odsAutoResize Auto Resize} for more informations
         * @param {boolean} [refineOnClick] see {@link ods-widgets.directive:refineOnClick Refine on click} for more informations. This option takes precedence over the widget tooltip.
         *
         * @description
         * This widget displays an image gallery of a dataset containing media with thumbnails (images, pdf files...) with infinite scroll.
         * You can use the {@link ods-widgets.directive:odsWidgetTooltip Widget Tooltip} directive to customize the detail view appearing when selecting a thumbnail.
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-dataset-context context="stations" stations-domain="public.opendatasoft.com" stations-dataset="frenchcheese">
         *              <ods-media-gallery context="stations" ods-auto-resize ods-widget-tooltip>
         *                  <h3>My custom tooltip</h3>
         *                  {{ getRecordTitle(record) }}
         *              </ods-media-gallery>
         *          </ods-dataset-context>
         *      </file>
         *  </example>
         */
        var detailsTemplate,
            defaultDetailsTemplate = "" +
                '<div>' +
                    '<div class="ods-media-gallery__tooltip__image-container" width="{{ image.realwidth }}px" height="{{ image.realheight }}px">' +
                    '   <img class="ods-media-gallery__tooltip__image" ng-src="{{ image.thumbnail_url }}">' +
                    '</div>' +
                    '<div class="ods-media-gallery__tooltip__fields">' +
                        '<h2 ng-if="getRecordTitle(record)">' +
                        '   {{ getRecordTitle(record) }}' +
                        '</h2>' +
                        '<dl>' +
                        '   <dt ng-repeat-start="field in displayedFields"' +
                        '           ng-show="record.fields[field.name]|isDefined"' +
                        '           class="ods-dataset-images__infopane-field-name">' +
                        '       {{ field.label }}' +
                        '   </dt>' +
                        '   <dd ng-repeat-end ng-switch="field.type"' +
                        '           ng-show="record.fields[field.name]|isDefined">' +
                        '       <span ng-switch-when="geo_point_2d">' +
                        '           <ods-geotooltip width="300" height="300"' +
                        '                   coords="record.fields[field.name]">{{ record.fields|formatFieldValue:field }}</ods-geotooltip>' +
                        '       </span>' +
                        '       <span ng-switch-when="geo_shape">' +
                        '            <ods-geotooltip width="300" height="300"' +
                        '                   geojson="record.fields[field.name]">{{ record.fields|formatFieldValue:field }}</ods-geotooltip>' +
                        '        </span>' +
                        '        <span ng-switch-when="double">{{ record.fields|formatFieldValue:field }}</span>' +
                        '        <span ng-switch-when="int">{{ record.fields|formatFieldValue:field }}</span>' +
                        '        <span ng-switch-when="date">{{ record.fields|formatFieldValue:field }}</span>' +
                        '        <span ng-switch-when="datetime">{{ record.fields|formatFieldValue:field }}</span>' +
                        '        <span ng-switch-when="file">' +
                        '            <div ng-bind-html="record.fields|formatFieldValue:field"></div>' +
                        '        </span>' +
                        '       <span ng-switch-default ng-bind-html="record.fields[field.name]|prettyText|nofollow|safenewlines"></span>' +
                        '   </dd>' +
                        '</dl>' +
    
                        '<a href="{{ image.download_url }}"' +
                        '       target="_self"' +
                        '       ods-resource-download-conditions' +
                        '       class="ods-button">' +
                        '   <i class="fa fa-download"></i>' +
                        '   <span translate>Download image</span>' +
                        '</a>' +
                    '</div>' +
                '</div>';

        return {
            restrict: 'E',
            scope: {
                context: '=',
                displayedFields: '@',
                imageFields: '@?',
                displayMode: '@?'
            },
            replace: true,
            template: '<div class="odswidget odswidget-media-gallery">' +
                                ' <div class="odswidget-media-gallery__container" >' +
                                '     <div style="vertical-align: top;" class="odswidget-images__internal-table" infinite-scroll="loadMore()" infinite-scroll-distance="1" infinite-scroll-disabled="fetching">' +
                                '        <div class="odswidget-media-gallery__media-line" ng-repeat="line in lines">' +
                                '            <div ng-class="{\'odswidget-media-gallery__media-container--selected\': image.selected}" class="odswidget-media-gallery__media-container" style="vertical-align: top; display: inline-block" ng-repeat="image in line.images" ng-click="onClick($event, image, line)" data-index="{{ image.index + 1 }}">' +
                                '                <div style="overflow: hidden" ng-style="{width: image.width, height: image.height, marginTop: image.marginTop, marginBottom: image.marginBottom, marginRight: image.marginRight, marginLeft: image.marginLeft }">' +
                                '                    <ods-record-image record="image.record" field="{{ image.fieldname }}" domain-url="{{context.domainUrl}}"></ods-record-image>' +
                                '                    <div ng-if="getRecordTitle(image.record)" class="odswidget-media-gallery__media-container__title-container">{{ getRecordTitle(image.record) }}</div>' +
                                '                </div>' +
                                '            </div>' +
                                '        </div>' +
                                '     </div>' +
                                '     <ods-spinner ng-if="!init && fetching"></ods-spinner>' +
                                ' </div>' +
                                ' <div class="odswidget-media-gallery__details"></div>' +
                                ' <div class="odswidget-overlay" ng-if="done && !records"><span class="odswidget-overlay__message" translate>No results</span></div>' +
                                ' <div class="odswidget-overlay" ng-if="fetching && !records"><ods-spinner></ods-spinner></div>' +
                                '</div>',
            require: ['odsMediaGallery', '?odsWidgetTooltip', '?odsAutoResize', '?refineOnClick'],
            controller: ['$scope', '$element', '$window', 'ODSAPI', 'DebugLogger', '$filter', '$http', '$q', function($scope, $element, $window, ODSAPI, DebugLogger, $filter, $http, $q) {
                // Infinite scroll parameters
                $scope.page = 0;
                $scope.resultsPerPage = 40;
                $scope.fetching = true;

                $scope.staticSearchOptions = {
                    rows: $scope.resultsPerPage
                };

                // New records are appended to the end of this array
                $scope.records = [];
                $scope.images = [];

                $scope.done = false;
                $scope.init = true;
                $scope.nextImage = 0;

                if (typeof($scope.imageFields) == "undefined") {
                    $scope.imageFields = [];
                }

                var currentRequestsTimeouts = [];

                var refreshRecords = function () {
                    $scope.fetching = true;
                    var options = {}, start;

                    if ($scope.init) {
                        start = 0;
                        if (currentRequestsTimeouts.length) {
                            currentRequestsTimeouts.forEach(function (t) {
                                t.resolve();
                            });
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

                    var timeout = $q.defer();
                    currentRequestsTimeouts.push(timeout);

                    if (angular.isDefined(options.q)) {
                        options.q = [options.q];
                    } else {
                        options.q = [];
                    }
                    var restriction_query = [];
                    angular.forEach($scope.imageFields, function(field) {
                        restriction_query.push('NOT #null(' + field + ')');
                    });
                    options.q.push(restriction_query.join(" OR "));

                    ODSAPI.records.search($scope.context, options, timeout.promise).
                        success(function (data, status, headers, config) {
                            $scope.records = $scope.records.concat(data.records);

                            var i, j, url, image, placeholder;
                            for (i = 0; i < data.records.length; i++) {
                                for (j = 0; j < $scope.imageFields.length; j++) {
                                    if (data.records[i].fields[$scope.imageFields[j]]) {
                                        image = data.records[i].fields[$scope.imageFields[j]];
                                        if (image.url) {
                                            url = image.url;
                                            placeholder = false;
                                        } else if (image.placeholder) {
                                            url = null;
                                            placeholder = true;
                                        } else {
                                            url = $scope.context.domainUrl + '/explore/dataset/' + data.records[i].datasetid + '/files/' + image.id + '/300/';
                                            placeholder = false;
                                        }

                                        $scope.images.push({
                                            'record': data.records[i],
                                            'fieldname': $scope.imageFields[j],
                                            'thumbnail_url': url,
                                            'download_url': url.replace('/300/', '/download/'),
                                            'id': image.id,
                                            'index': $scope.images.length,
                                            'placeholder': placeholder,
                                            'realwidth': image.width,
                                            'realheight': image.height
                                        });
                                    }
                                }
                            }
                            $scope.error = '';
                            $scope.fetching = false;
                            $scope.done = ($scope.page + 1) * $scope.resultsPerPage >= data.nhits;
                            $scope.init = false;

                            currentRequestsTimeouts.splice(currentRequestsTimeouts.indexOf(timeout), 1);
                        }).
                        error(function (data, status, headers, config) {
                            if (data) {
                                // Errors without data are cancelled requests
                                $scope.error = data.error;
                            }
                            currentRequestsTimeouts.splice(currentRequestsTimeouts.indexOf(timeout), 1);
                            $scope.fetching = false;
                        });
                };

                this.getDefaultsFromContext = function () {
                    var dataset = $scope.context.dataset,
                        validatedImageFields = [],
                        i,
                        j;


                    if ($scope.context.dataset.extra_metas.visualization && $scope.context.dataset.extra_metas.visualization.image_tooltip_html) {
                        detailsTemplate = '<div>' + $scope.context.dataset.extra_metas.visualization.image_tooltip_html + '</div>';
                    } else {
                        detailsTemplate = defaultDetailsTemplate;
                    }

                    $scope.detailsTemplate = detailsTemplate;

                    if ($scope.context.dataset.extra_metas.visualization && $scope.context.dataset.extra_metas.visualization.media_gallery_fields) {
                        $scope.imageFields = $scope.context.dataset.extra_metas.visualization.media_gallery_fields;
                    } else {
                        for (i = 0; i < dataset.fields.length; i++) {
                            if (dataset.fields[i].type == "file") {
                                for (j = 0; j < dataset.fields[i].annotations.length; j++) {
                                    if (dataset.fields[i].annotations[j].name == "has_thumbnails" &&
                                        ($scope.imageFields.length === 0 || $scope.imageFields.indexOf(dataset.fields[i].name) > -1)) {
                                        validatedImageFields.push(dataset.fields[i].name);
                                    }
                                }
                            }
                        }
                        $scope.imageFields = validatedImageFields;
                    }

                    refreshRecords();
                };

                this.watchContext = function() {
                    $scope.$watch('context.parameters', function(nv, ov) {
                        if (nv !== ov) {
                            $scope.done = false;
                            $scope.lines.splice(0, $scope.lines.length);
                            $scope.images.splice(0, $scope.images.length);
                            $scope.records.splice(0, $scope.records.length);
                            $scope.nextImage = 0;
                            $scope.init = true;
                            $scope.page = 0;
                            $scope.layout.resetImages();
                            refreshRecords();
                        }
                    }, true);
                };

                // Automatically called by ng-infinite-scroll
                $scope.loadMore = function () {
                    if (!$scope.fetching && !$scope.done && $scope.staticSearchOptions) {
                        refreshRecords();
                    }
                };

                $scope.detailsDisplayed = false;

                $scope.getRecordTitle = function (record) {
                    if ($scope.context.dataset.extra_metas && $scope.context.dataset.extra_metas.visualization && $scope.context.dataset.extra_metas.visualization.image_title) {
                        var titleField = $scope.context.dataset.extra_metas.visualization.image_title;
                        if (angular.isDefined(record.fields[titleField]) && record.fields[titleField] !== '') {
                            return $filter('formatFieldValue')(record.fields, $scope.context.dataset.getField(titleField));
                        }
                    }
                    return null;
                };
            }],
            link: function(scope, element, attrs, ctrl) {
                var controller = ctrl[0],
                    customTooltipCtrl = ctrl[1],
                    autoResizeCtrl = ctrl[2],
                    refineOnClickCtrl = ctrl[3];

                // resize
                if (autoResizeCtrl) {
                    autoResizeCtrl.onResize = function() {
                        scope.lines.splice(0, scope.lines.length);
                        scope.layout.reset();
                        scope.layout.render(scope.lines, element.children()[0].getBoundingClientRect().width, scope.images.length);
                    };
                }

                scope.context.wait().then(function () {
                    controller.getDefaultsFromContext();
                    controller.watchContext();

                    if (customTooltipCtrl !== null) {
                        var displayed_fields;
                        if (scope.displayedFields) {
                            displayed_fields = scope.context.dataset.fields.filter(function(field) {
                                return scope.displayedFields.indexOf(field.name) !== -1;
                            });
                        } else if (scope.context.dataset.extra_metas.visualization && scope.context.dataset.extra_metas.visualization.image_fields) {
                            displayed_fields = scope.context.dataset.fields.filter(function(field) {
                                return scope.context.dataset.extra_metas.visualization.image_fields.indexOf(field.name) !== -1;
                            });
                        } else {
                            displayed_fields = scope.context.dataset.fields;
                        }

                        customTooltipCtrl.configure({
                            'defaultTemplate': scope.detailsTemplate,
                            'displayedFields': displayed_fields,
                            'fields': scope.context.dataset.fields
                        });
                    }
                });

                var detailsContainer = element.find(".odswidget-media-gallery__details");

                if (typeof scope.displayMode === "undefined") {
                    scope.displayMode = "compact";
                } else if (!layouts[scope.displayMode + "Layout"]) {
                    console.warn("ods-media-gallery " + scope.displayMode + " displayMode is not valid.");
                    scope.displayMode = "compact";
                }

                scope.max_height = 400;
                var detailsScope, displayedImage;
                detailsContainer = detailsContainer.remove();
                scope.onClick = function($event, image, line) {

                    if (refineOnClickCtrl !== null) {
                        refineOnClickCtrl.refineOnRecord(image.record);
                    } else if (customTooltipCtrl !== null) {
                        if (detailsScope) {
                            detailsScope.$destroy();
                        }
                        if (displayedImage) {
                            displayedImage.selected = false;
                        }
                        if (displayedImage === image) {
                            displayedImage = null;
                            detailsContainer = detailsContainer.remove();
                            return;
                        } else {
                            displayedImage = image;
                        }

                        image.selected = true;
                        detailsContainer.html(customTooltipCtrl.render(image.record, {
                            'image': angular.copy(image),
                            'getRecordTitle': scope.getRecordTitle
                        }, image.fieldname));
                        detailsContainer = detailsContainer.remove();
                        detailsContainer.insertAfter(angular.element($event.currentTarget).parent('.odswidget-media-gallery__media-line'));
                    }
                };

                scope.lines = [];
                scope.layout = layouts()[scope.displayMode + "Layout"]();
                scope.layout.resetImages();

                scope.$watch('images', function(newValue, oldValue) {
                    var i, width, height, image;
                    if (newValue !== oldValue) {
                        for (i = scope.nextImage; i < newValue.length; i++) {
                            image = newValue[i];
                            scope.layout.addImage(image, scope.images.length);
                        }
                        scope.nextImage = i;
                    }
                    scope.layout.render(scope.lines, element.children()[0].getBoundingClientRect().width, scope.images.length);
                }, true);
            }
        };
    }]);


    var layouts = function() {
        var ratioSum = 0,
            MAX_HEIGHT = 250,
            MARGIN = 1,
            previousLineOffset = 0,
            images = [],
            lastRenderedImage = -1,
            rendering = false;

        var layout = {
            reset: function() {
                ratioSum = 0;
                previousLineOffset = 0;
                lastRenderedImage = -1;
            },
            resetImages: function() {
                images.splice(0, images.length);
                this.reset();
            },
            addImage: function addImage(image) {
                var localImage = angular.copy(image);
                images.push(localImage);
            }
        };

        function extend(obj, src) {
            Object.keys(src).forEach(function(key) { obj[key] = src[key]; });
            return obj;
        }

        return {
            largeLayout: function() {
                return extend({
                    render: function(lines, containerWidth, imagesCount) {
                        if (rendering) {
                            return;
                        }
                        rendering = true;
                        var i, image, width, height, currentLine;
                        if (lines.length === 0) {
                            lines.push({
                                'images': [],
                                'height': MAX_HEIGHT,
                                'offset': 0,
                                'cumulated_width': 0
                            });
                        }

                        for (i = lastRenderedImage + 1; i < images.length; i++) {
                            image = images[i];
                            currentLine = lines[lines.length - 1];
                            if (image.realheight > MAX_HEIGHT - 20) {
                                width = Math.floor(image.realwidth * (MAX_HEIGHT - 20) / image.realheight);
                                height = (MAX_HEIGHT - 20);
                            } else {
                                width = image.realwidth;
                                height = image.realheight;
                            }

                            if (width > containerWidth) {
                                height = Math.floor(height * containerWidth / width);
                                width = containerWidth;
                            }
                            if (currentLine.cumulated_width + width < containerWidth) {
                                currentLine.images.push(
                                    extend({
                                        'width': width,
                                        'height': height
                                    }, image)
                                );
                                currentLine.cumulated_width += width;
                            } else {
                                // resolve previous line
                                angular.forEach(currentLine.images, function (image, index) {
                                    image.marginTop = image.marginBottom = (currentLine.height - image.height) / 2;
                                    image.marginLeft = image.marginRight = Math.floor((containerWidth - currentLine.cumulated_width) / (currentLine.images.length * 2));
                                });
                                // create a new line
                                lines.push({
                                    'images': [],
                                    'height': MAX_HEIGHT,
                                    'offset': 0,
                                    'cumulated_width': 0
                                });
                                lines[lines.length - 1].images.push(
                                    extend({
                                        'width': width,
                                        'height': height
                                    }, image)
                                );
                                lines[lines.length - 1].cumulated_width = width;
                            }
                            lastRenderedImage += 1;
                        }

                        if (lastRenderedImage === imagesCount - 1) {
                            currentLine = lines[lines.length - 1];
                            angular.forEach(currentLine.images, function (image, index) {
                                image.marginTop = image.marginBottom = (currentLine.height - image.height) / 2;
                                image.marginLeft = image.marginRight = Math.floor((containerWidth - currentLine.cumulated_width) / (currentLine.images.length * 2));
                            });
                        }
                        rendering = false;
                    }
                }, layout);
            },
            compactLayout: function() {
                return extend({
                    render: function(lines, containerWidth, imagesCount) {
                        if (rendering) {
                            return;
                        }
                        rendering = true;
                        var i, image;
                        if (lines.length === 0) {
                            lines.push({
                                'images': [],
                                'height': MAX_HEIGHT,
                                'offset': 0,
                                'max_height': 0
                            });
                        }
                        for (i = lastRenderedImage + 1; i < images.length; i++) {
                            image = images[i];
                            var ratio = image.realwidth / image.realheight;
                            var currentLine = lines[lines.length - 1];
                            currentLine.images.push(image);
                            currentLine.max_height = Math.min(MAX_HEIGHT, Math.max(currentLine.max_height, image.realheight));
                            ratioSum += ratio;
                            currentLine.height = Math.min(Math.floor((containerWidth - MARGIN * (currentLine.images.length - 1)) / ratioSum), currentLine.max_height);

                            if (currentLine.height < currentLine.max_height || image.index === imagesCount - 1) {
                                // this line is done
                                var lineWidth = 0;
                                $.each(currentLine.images, function (index, image) {
                                    image.height = currentLine.height;
                                    image.width = Math.floor(image.realwidth * image.height / image.realheight);
                                    image.marginTop = image.marginBottom = image.marginRight = image.marginLeft = MARGIN + "px";
                                    lineWidth += image.width + 2 * MARGIN;
                                });

                                currentLine.offset = previousLineOffset + currentLine.max_height;

                                while (lineWidth > containerWidth) {
                                    angular.forEach(currentLine.images, function (image, index) {
                                        if (lineWidth > containerWidth) {
                                            image.width -= 1;
                                            lineWidth -= 1;
                                        }
                                    });
                                }
                            }
                            if (currentLine.height < currentLine.max_height) {
                                previousLineOffset += currentLine.height;
                                lines.push({
                                    'images': [],
                                    'height': MAX_HEIGHT,
                                    'offset': 0,
                                    'max_height': 0
                                });
                                ratioSum = 0;
                            }
                            lastRenderedImage += 1;
                        }
                        rendering = false;
                    }
                }, layout);
            }
        };
    };
}());
;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsMostPopularDatasets', ['ODSAPI', function(ODSAPI) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsMostPopularDatasets
         * @scope
         * @restrict E
         * @param {CatalogContext} context {@link ods-widgets.directive:odsCatalogContext Catalog Context} to use
         * @description
         * This widget displays the top 5 datasets of a catalog, based on the number of downloads.
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-catalog-context context="public" public-domain="public.opendatasoft.com">
         *              <ods-most-popular-datasets context="public"></ods-most-popular-datasets>
         *          </ods-catalog-context>
         *      </file>
         *  </example>
         */
        return {
            restrict: 'E',
            replace: true,
            template: '<div class="odswidget odswidget-most-popular-datasets">' +
                '<ul class="odswidget-most-popular-datasets__datasets">' +
                '   <li class="no-data" ng-hide="datasets" translate>No data available yet</li>' +
                '   <li class="odswidget-most-popular-datasets__dataset" ng-repeat="dataset in datasets" ng-if="datasets">' +
                '       <ods-theme-picto class="odswidget-most-popular-datasets__theme-picto" theme="{{dataset.metas.theme|firstValue}}"></ods-theme-picto>' +
                '       <div class="odswidget-most-popular-datasets__dataset-details">' +
                '           <div class="odswidget-most-popular-datasets__dataset-details-title"><a ng-href="{{context.domainUrl}}/explore/dataset/{{dataset.datasetid}}/" target="_self">{{ dataset.metas.title }}</a></div>' +
                '           <div class="odswidget-most-popular-datasets__dataset-details-count"><i class="fa fa-download"></i> <span translate translate-n="dataset.extra_metas.explore.download_count" translate-plural="{{$count}} downloads">{{$count}} download</span></div>' +
                '       </div>' +
                '   </li>' +
                '</ul>' +
                '</div>',
            scope: {
                context: '='
            },
            controller: ['$scope', function($scope) {
                var refresh = function() {
                    ODSAPI.datasets.search($scope.context, {'rows': 5, 'sort': 'explore.download_count', 'extrametas': true}).
                        success(function(data) {
                            $scope.datasets = data.datasets;
                        });
                };
                $scope.$watch('context', function() {
                    refresh();
                });
            }]
        };
    }]);

}());;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsMostUsedThemes', ['ODSAPI', function(ODSAPI) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsMostUsedThemes
         * @scope
         * @restrict E
         * @param {CatalogContext} context {@link ods-widgets.directive:odsCatalogContext Catalog Context} to use
         * @description
         * This widget displays the 5 most used themes.
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-catalog-context context="public" public-domain="public.opendatasoft.com">
         *              <ods-most-used-themes context="public"></ods-most-used-themes>
         *          </ods-catalog-context>
         *      </file>
         *  </example>
         */
        return {
            restrict: 'E',
            replace: true,
            template: '<div class="odswidget odswidget-most-used-themes">' +
                '<ul class="odswidget-most-used-themes__themes">' +
                '   <li class="no-data" ng-hide="themes" translate>No data available yet</li>' +
                '   <li class="odswidget-most-used-themes__theme" ng-repeat="theme in themes" ng-if="themes">' +
                '       <div class="odswidget-most-used-themes__theme-details">' +
                '           <div class="odswidget-most-used-themes__theme-details-name"><a ng-href="{{ context.domainUrl }}/explore/?refine.theme={{ theme.path }}" target="_self">{{ theme.name }}</a></div>' +
                '           <div class="odswidget-most-used-themes__theme-details-count"><i class="fa fa-table"></i> <span translate translate-n="theme.count" translate-plural="Used by {{$count}} datasets">Used by {{$count}} dataset</span></div>' +
                '       </div>' +
                '   </li>' +
                '</ul>' +
                '</div>',
            scope: {
                context: '='
            },
            controller: ['$scope', function($scope) {
                var refresh = function() {
                    ODSAPI.datasets.facets($scope.context, 'theme').
                        success(function(data) {
                            if (data.facet_groups) {
                                $scope.themes = data.facet_groups[0].facets.slice(0, 5);
                            }
                        });
                };
                $scope.$watch('context', function() {
                    refresh();
                });
            }]
        };
    }]);

}());;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsPaginationBlock', ['$location', function($location) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsPaginationBlock
         * @scope
         * @restrict E
         * @param {CatalogContext|DatasetContext} context {@link ods-widgets.directive:odsCatalogContext Catalog Context} or {@link ods-widgets.directive:odsDatasetContext Dataset Context} to use
         * @param {number} [perPage=10] How many results should be contained per page.
         * @param {boolean} [nofollow=false] If true, all links within the widget (used to change page) will contain a `rel="nofollow"` attribute.
         * It should be used if you don't want search engines to crawl all the pages of your widget.
         * @description
         * This widget displays a pagination control that you can use to make the context "scroll" through a list of results. It doesn't display
         * results by itself, and therefore should be paired with another widget. Note that by itself it also doesn't control the number of results fetched by the context,
         * and the `perPage` parameter should be the same as the `rows` parameter on the context.
         *
         * If you just want to display results with a pagination system, you can have a look at {@link ods-widgets.directive:odsResultEnumerator odsResultEnumerator}
         * which already include this directive (if the relevant parameter is active on the widget).
         */

        /*
        This directive builds a pagination block.
         */
        return {
            restrict: 'E',
            replace: true,
            template: '' +
                '<div class="odswidget odswidget-pagination" ng-show="pages.length > 1">' +
                '    <ul class="odswidget-pagination__page-list">' +
                '        <li class="odswidget-pagination__page" ng-repeat="page in pages">' +
                '            <a class="odswidget-pagination__page-link" ' +
                '               ng-class="{\'odswidget-pagination__page-link--active\': page.start == (context.parameters.start||0)}" ' +
                '               ng-attr-rel="{{nofollow?\'nofollow\':\'\'}}"' +
                '               ng-click="click($event, page.start)" ' +
                '               href="?start={{ page.start }}" ' +
                '               rel="nofollow">{{ page.label }}</a>' +
                '        </li>' +
                '    </ul>' +
                '</div>',
            scope: {
                context: '=',
                perPage: '@',
                nofollow: '@'
            },
            controller: ['$scope', '$anchorScroll', function($scope, $anchorScroll) {
                $scope.location = $location;
                $scope.pages = [];
                $scope.perPage = $scope.perPage || 10;

                $scope.click = function(e, start) {
                    e.preventDefault();
                    $scope.context.parameters.start = start;
                };
                var buildPages = function() {
                    if ($scope.context.nhits === 0) {
                        $scope.pages = [];
                        return;
                    }
                    var pagesCount = Math.max(1, Math.floor(($scope.context.nhits-1) / $scope.perPage) + 1);
                    var pages = [];
                    var pageNum;
                    if (pagesCount <= 8) {
                        for (pageNum=1; pageNum<=pagesCount; pageNum++) {
                            pages.push({'label': pageNum, 'start': (pageNum-1)*$scope.perPage});
                        }
                    } else {
                        // If too many items, cut them : "first", the 3 before the current page,
                        // the current page, the 3 after, and "last"
                        var currentPage;
                        if (!$scope.context.parameters.start) {
                            currentPage = 1;
                        } else {
                            currentPage = Math.floor($scope.context.parameters.start / $scope.perPage) + 1;
                        }
                        if (currentPage <= 5) {
                            for (pageNum=1; pageNum<=8; pageNum++) {
                                pages.push({'label': pageNum, 'start': (pageNum-1)*$scope.perPage});
                            }
                            pages.push({'label': '>>', 'start': (pagesCount-1)*$scope.perPage});
                        } else if (currentPage >= (pagesCount-4)) {
                            pages.push({'label': '<<', 'start': 0});
                            for (pageNum=(pagesCount-7); pageNum<=pagesCount; pageNum++) {
                                pages.push({'label': pageNum, 'start': (pageNum-1)*$scope.perPage});
                            }
                        } else {
                            pages.push({'label': '<<', 'start': 0});
                            for (pageNum=(currentPage-3); pageNum<=(currentPage+3); pageNum++) {
                                pages.push({'label': pageNum, 'start': (pageNum-1)*$scope.perPage});
                            }
                            pages.push({'label': '>>', 'start': (pagesCount-1)*$scope.perPage});
                        }
                    }
                    $scope.pages = pages;
                };

                var unwatch = $scope.$watch('context', function(nv, ov) {
                    if (nv) {
                        $scope.$watch('context.nhits', function(newValue, oldValue) {
                            if ($scope.context.nhits !== undefined && $scope.perPage)
                                buildPages();
                        });
                        $scope.$watch('perPage', function(newValue, oldValue) {
                            if ($scope.context.nhits && $scope.perPage)
                                buildPages();
                        });
                        $scope.$watch('context.parameters.start', function(newValue, oldValue) {
                            if ($scope.context.nhits && $scope.perPage)
                                buildPages();
                            $anchorScroll();
                        });
                        unwatch();
                    }
                });

            }]
        };
    }]);

}());;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsPicto', ['SVGInliner', '$http', '$document', function(SVGInliner, $http, $document) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsPicto
         * @scope
         * @restrict E
         * @param {string} url The url of the svg or image to display
         * @param {string} color The color to use to fill the svg
         * @param {classes} string The classes to directly apply to the svg element
         * @description
         * This widget displays a "picto" specified by a url and force a fill color on it.
         * This element can be styled (height, width...), especially if the picto is vectorial (SVG).
         * @todo implement defs and use in svg
         */
        return {
            restrict: 'E',
            replace: true,
            scope: {
                url: '=',
                color: '=',
                classes: '='
            },
            template: '<div class="odswidget odswidget-picto {{ classes }}"></div>',
            link: function(scope, element) {
                var svgContainer;
                scope.$watch('[url, color]', function(nv) {
                    if (nv[0]) {
                        if (Modernizr && !Modernizr.svg) {
                            return;
                        }
                        if (svgContainer) {
                            element.empty();
                        }
                        svgContainer = SVGInliner.getElement(scope.url, scope.color);
                        if (!scope.color) {
                            svgContainer.addClass('ods-svginliner__svg-container--colorless');
                        }
                        element.append(svgContainer);
                    }
                }, true);
            }
        };
    }]);

    mod.directive('odsThemePicto', ['ODSWidgetsConfig', '$compile', function(ODSWidgetsConfig, $compile) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsThemePicto
         * @scope
         * @restrict E
         * @param {string} theme The label of the theme to display the picto of.
         * @description
         * This widget displays the "picto" of a theme, based on the `themes` setting in {@link ods-widgets.ODSWidgetsConfigProvider ODSWidgetsConfig}.
         * This element can be styled (height, width...), especially if the picto is vectorial (SVG).
         *
         */
        return {
            restrict: 'E',
            replace: true,
            scope: {
                theme: '@'
            },
            template: '',
            link: function(scope, element) {
                scope.originalClasses = element.attr('class').replace('ng-isolate-scope', '').trim();
                var template = '<ods-picto url="themeConfig.url" color="themeConfig.color" classes="originalClasses + \' odswidget-theme-picto theme-\' + (getTheme()|themeSlug) "></ods-picto>';
                var themeConfig = null;
                var defaultPicto = false;
                if (ODSWidgetsConfig.themes[scope.theme] && ODSWidgetsConfig.themes[scope.theme].url) {
                    scope.themeConfig = ODSWidgetsConfig.themes[scope.theme];
                } else {
                    scope.themeConfig = ODSWidgetsConfig.themes['default'];
                    defaultPicto = true;
                }
                scope.getTheme = function() {
                    if (defaultPicto) {
                        return 'default';
                    } else {
                        return scope.theme;
                    }
                };
                if (scope.themeConfig) {
                    element.replaceWith(angular.element($compile(template)(scope)));
                }
            }
        };
    }]);

    mod.directive('odsMapPicto', ['ODSWidgetsConfig', 'PictoHelper', '$compile', function(ODSWidgetsConfig, PictoHelper, $compile) {
        return {
            restrict: 'E',
            replace: true,
            scope: {
                name: '@',
                color: '@'
            },
            template: '',
            link: function(scope, element) {
                scope.originalClasses = element.attr('class').replace('ng-isolate-scope', '').trim();
                var template = '<ods-picto url="pictoUrl" color="color" classes="originalClasses + \' odswidget-map-picto\'"></ods-picto>';

                scope.$watch('[name, color]', function() {
                    scope.pictoUrl = PictoHelper.mapPictoToURL(scope.name);
                    if (scope.pictoUrl) {
                        element.replaceWith(angular.element($compile(template)(scope)));
                    }
                }, true);
            }
        };
    }]);
}());;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsPlumeAirQuality', function() {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsPlumeAirQuality
         * @restrict E
         * @scope
         * @param {string} city The name of the city you want to integrate. See http://www.plumelabs.com/embed/ for more information.
         * @param {string} lang fr_fr for the french version, en_us for the english one.
         * @description
         * Integrates a Plume Air Embed using a city name.
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-plume-air-quality city="new-york"></ods-plume-air-quality>
         *      </file>
         *  </example>
         */
        return {
            restrict: 'E',
            replace: true,
            template: '<div class="odswidget"></div>',
            scope: {
                'city': '@',
                'lang': '@'
            },
            link: function(scope, element, attrs) {
                var html = '' +
                    '<a id="plumelabs-wjs-cfg" data-w="320" data-h="200" data-city="'+attrs.city+'" data-lng="'+(attrs.lang || 'en_us')+'" data-type="l">Air Quality</a>' +
                    '<script>window.plmlbs=function(e,t,s){var l,m=e.getElementsByTagName(t)[0],n=window.plmlbs||{},a=/^http:/.test(e.location)?"http":"https";return e.getElementById(s)?n:(l=e.createElement(t),l.id=s,l.src=a+"://static.plumelabs.com/embed/embed.js",m.parentNode.insertBefore(l,m),n)}(document,"script","plumelabs-wjs");</script>';
                element.append(html);
            }
        };
    });
}());;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsRecordImage', function() {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsRecordImage
         * @restrict E
         * @scope
         * @param {DatasetContext} context {@link ods-widgets.directive:odsDatasetContext Dataset Context} to use
         * @param {Object} record Record to take the image from
         * @param {string} [field=none] Field to use. By default, the first `file` field will be used, but you can specify the field name if there are more than one.
         * @param {string} [domainUrl=none] the base url of the domain where the dataset can be record. By default, it uses the current.
         * @description
         * Displays an image from a record
         *
         */
        return {
            restrict: 'E',
            replace: true,
            template: '' +
                '<div class="odswidget odswidget-record-image">' +
                '   <img class="odswidget-record-image__image" ng-if="imageUrl" ng-src="{{ imageUrl }}">' +
                '   <div class="odswidget-record-image__image odswidget-record-image__image--placeholder" ng-if="placeholder">' +
                '</div>',
            scope: {
                record: '=',
                field: '@',
                domainUrl: '@?'
            },
            controller: ['$scope', function($scope) {
                $scope.imageUrl = null;

                var render = function() {
                    var image = $scope.record.fields[$scope.field];
                    if (image.url) {
                        $scope.imageUrl = image.url;
                        $scope.placeholder = false;
                    } else if (image.placeholder) {
                        $scope.imageUrl = null;
                        $scope.placeholder = true;
                    } else {
                        $scope.imageUrl = ($scope.domainUrl || '') + '/explore/dataset/' + $scope.record.datasetid + '/files/' + image.id + '/300/';
                        $scope.placeholder = false;
                    }
                };

                $scope.$watch('[record, field]', function() {
                    render();
                }, true);
            }]
        };
    });
}());;(function () {
    'use strict';

    var mod = angular.module('ods-widgets');

    var refineOnClickDirective = function () {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:refineOnClick
         * @restrict A
         * @scope
         * @description
         * This directive will refine the given context(s) for a click on an element representing a record.
         *
         * It works in conjunction with a finite set of other directives:
         * * {@link ods-widgets.directive:odsCalendar odsCalendar}
         * * {@link ods-widgets.directive:odsImages odsImages}
         * * {@link ods-widgets.directive:odsMap odsMap}
         * * {@link ods-widgets.directive:odsMapLayer odsMapLayer}
         * * {@link ods-widgets.directive:odsChart odsChart}
         * * {@link ods-widgets.directive:odsChartSerie odsChartSerie}
         *
         * In order for a widget to support refineOnClick, it must accept within it link function an optional
         * refineOnClickCtrl that exposes a method refineOnClickCtrl.refineContext(record) that must be called for
         * each relevant click.
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <my-directive refine-on-click
         *                        refine-on-click-context="mycontext"
         *                        refine-on-click-record-field="field1"
         *                        refine-on-click-context-field="field2"></my-directive>
         *      </file>
         *  </example>
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <my-directive refine-on-click
         *                        refine-on-click-context="mycontext, mycontext2"
         *                        refine-on-click-mycontext-record-field="field1"
         *                        refine-on-click-mycontext-context-field="field2"
         *                        refine-on-click-mycontext2-record-field="field3"
         *                        refine-on-click-mycontext2-context-field="field4"></my-directive>
         *      </file>
         *  </example>
         */
        return {
            restrict: 'A',
            controller: function ($scope, $element, $attrs) {
                var refineConfigurations = [];

                // the exposed methods

                this.refineOnRecord = function (record) {
                    angular.forEach(refineConfigurations, function (refineConf) {
                        refineConf.context.toggleRefine(refineConf.contextField, record.fields[refineConf.recordField]);
                    });
                };

                this.refineOnValue = function (value) {
                    angular.forEach(refineConfigurations, function (refineConf) {
                        refineConf.context.toggleRefine(refineConf.contextField, value);
                    });
                };

                // parse attributes and build conf
                var unwatchRefineOnClick = $scope.$watch(
                    function () {
                        return $attrs.refineOnClickContext
                    },
                    function (nv) {
                        // parse contexts
                        var contextNames = nv.split(',');
                        var contexts = [];
                        var allContextDefined = true;
                        angular.forEach(contextNames, function (contextName) {
                            var context = $scope[contextName];
                            allContextDefined = allContextDefined && angular.isDefined(context);
                            contexts.push(context);
                        });
                        if (!allContextDefined) {
                            return;
                        }

                        // parse refine options
                        angular.forEach(contexts, function (context) {
                            var attributeName = 'refineOnClick' + ODS.StringUtils.capitalize(context.name);
                            refineConfigurations.push({
                                context: context,
                                recordField: $attrs[attributeName + 'RecordField'] || $attrs['refineOnClickRecordField'],
                                contextField: $attrs[attributeName + 'ContextField'] || $attrs['refineOnClickContextField']
                            });
                            unwatchRefineOnClick();
                        });
                    }
                );
            }
        };
    };

    mod.directive('refineOnClick', refineOnClickDirective);
    // backward compatibility with previous implementations
    mod.directive('refineOnClickContext', refineOnClickDirective);
})();
;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsResultEnumerator', ['ODSAPI', function(ODSAPI) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsResultEnumerator
         * @scope
         * @restrict E
         * @param {CatalogContext|DatasetContext} context {@link ods-widgets.directive:odsCatalogContext Catalog Context} or {@link ods-widgets.directive:odsDatasetContext Dataset Context} to use
         * @param {number} [max=10] Maximum number of results to show
         * @param {boolean} [showHitsCounter=false] Display the number of hits (search results). This is the number of results available on the API, not the number of results displayed in the widget.
         * @param {boolean} [showPagination=false] Display a pagination block below the results, to be able to browse them all.
         * @description
         * This widget enumerates the results of a search (records for a {@link ods-widgets.directive:odsDatasetContext Dataset Context}, datasets for a {@link ods-widgets.directive:odsCatalogContext Catalog Context}) and repeats the template (the content of the directive element) for each of them.
         *
         * If used with a {@link ods-widgets.directive:odsCatalogContext Catalog Context}, for each result, the following AngularJS variables are available:
         *
         *  * item.datasetid: Dataset identifier of the dataset
         *  * item.metas: An object holding the key/values of metadata for this dataset
         *
         * If used with a {@link ods-widgets.directive:odsDatasetContext Dataset Context}, for each result, the following AngularJS variables are available:
         *
         *  * item.datasetid: Dataset identifier of the dataset this record belongs to
         *  * item.fields: an object hold all the key/values for the record
         *  * item.geometry: if the record contains geometrical information, this object is present and holds its GeoJSON representation
         *
         *  @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-catalog-context context="public" public-domain="public.opendatasoft.com">
         *              <ul>
         *                  <ods-result-enumerator context="public">
         *                      <li>
         *                          <strong>{{item.metas.title}}</strong>
         *                          (<a ng-href="{{context.domainUrl + '/explore/dataset/' + item.datasetid + '/'}}" target="_blank">{{item.datasetid}}</a>)
         *                      </li>
         *                  </ods-result-enumerator>
         *              </ul>
         *          </ods-catalog-context>
         *      </file>
         *  </example>
         */

        return {
            restrict: 'E',
            replace: true,
            transclude: true,
            scope: {
                context: '=',
                max: '@?',
                showHitsCounter: '@?',
                showPagination: '@?'
            },
            template: '' +
            '<div class="odswidget odswidget-result-enumerator">' +
            '    <div ods-results="items" ods-results-context="context" ods-results-max="{{maxHits}}">' +
            '        <div ng-if="loading"><ods-spinner class="odswidget-spinner--large"></ods-spinner></div>' +
            '        <div ng-if="!loading && !items.length" class="odswidget-result-enumerator__no-results-message" translate>No results</div>' +
            '        <div ng-if="!loading && items.length && hitsCounter" class="odswidget-result-enumerator__results-count">{{context.nhits}} <span translate>results</span></div>' +
            '        <div ng-repeat="item in items" inject class="odswidget-result-enumerator__item"></div>' +
            '    </div>' +
            '    <ods-pagination-block ng-if="pagination" context="context" per-page="{{maxHits}}"></ods-pagination-block>' +
            '</div>',
            controller: ['$scope', function($scope) {
                $scope.maxHits = $scope.max || 10;
                $scope.hitsCounter = (angular.isString($scope.showHitsCounter) && $scope.showHitsCounter.toLowerCase() === 'true');
                $scope.pagination = (angular.isString($scope.showPagination) && $scope.showPagination.toLowerCase() === 'true');
            }]
        };
    }]);

}());
;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsResults', ['ODSAPI', function(ODSAPI) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsResults
         * @scope
         * @restrict A
         * @param {string} [odsResults=results] Variable name to use
         * @param {CatalogContext|DatasetContext} odsResultsContext {@link ods-widgets.directive:odsCatalogContext Catalog Context} or {@link ods-widgets.directive:odsDatasetContext Dataset Context} to use
         * @param {number} [odsResultsMax=10] Maximum number of results to show
         * @description
         * This widget exposes the results of a search (as an array) in a variable available in the scope. It can be
         * used with AngularJS's ngRepeat to simply build a list of results.
         * It also adds to the context variable a "nhits" property containing the total number of records matching the
         * query regardless of the odsResultsMax value.
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-dataset-context context="tree" tree-dataset="arbresremarquablesparis2011" tree-domain="parisdata.opendatasoft.com" tree-parameters="{'sort': '-objectid'}">
         *              <table class="table table-bordered table-condensed table-striped">
         *                  <thead>
         *                      <tr>
         *                          <th>Tree name</th>
         *                          <th>Place</th>
         *                      </tr>
         *                  </thead>
         *                  <tbody>
         *                      <tr ng-repeat="item in items" ods-results="items" ods-results-context="tree" ods-results-max="10">
         *                          <td>{{ item.fields.nom_commun }}</td>
         *                          <td>{{ item.fields.nom_ev }}</td>
         *                      </tr>
         *                  </tbody>
         *              </table>
         *          </ods-catalog-context>
         *      </file>
         *  </example>
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-dataset-context context="tree" tree-dataset="arbresremarquablesparis2011" tree-domain="parisdata.opendatasoft.com" tree-parameters="{'sort': '-objectid'}">
         *              <p ods-results="items" ods-results-context="tree" ods-results-max="10">
         *                  Total number of trees : {{ tree.nhits }}
         *              </p>
         *          </ods-catalog-context>
         *      </file>
         *  </example>
         */

        return {
            restrict: 'A',
            scope: true,
            priority: 1001, // ng-repeat need to be executed when the results is in the scope.
            controller: ['$scope', '$attrs', function($scope, $attrs) {
                var loadResults = function (context) {
                    var options = angular.extend({}, context.parameters, {'rows': $attrs.odsResultsMax});
                    var variable = $attrs.odsResults || 'results';
                    $scope.loading = true;
                    if (context.type === 'catalog') {
                        angular.extend(options, {
                            extrametas: 'true',
                            interopmetas: 'true'
                        });
                        ODSAPI.datasets.search(context, options).success(function(data) {
                            $scope[variable] = data.datasets;
                            context.nhits = data.nhits;
                            $scope.loading = false;
                        }).error(function() {
                            $scope.loading = false;
                        });
                    } else if (context.type === 'dataset' && context.dataset) {
                        ODSAPI.records.search(context, options).success(function(data) {
                            $scope[variable] = data.records;
                            context.nhits = data.nhits;
                            $scope.loading = false;
                        }).error(function() {
                            $scope.loading = false;
                        });
                    }
                };
                var firstLoad = true;
                $scope.$watch($attrs.odsResultsContext, function(nv, ov) {
                    if (!!(nv.type === 'catalog' || (nv.type === 'dataset' && nv.dataset)) &&
                        (!angular.equals(nv.parameters, ov.parameters) || firstLoad)) {
                        firstLoad = false;
                        loadResults(nv);
                    }
                }, true);
            }]
        };
    }]);

}());
;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsReuses', ['ODSAPI', function(ODSAPI) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsReuses
         * @scope
         * @restrict E
         * @param {CatalogContext} context {@link ods-widgets.directive:odsCatalogContext Catalog Context} to use
         * @description
         * This widget displays all reuses published on a domain, in a infinite list of large boxes that presents them
         * in a clear display. The lists show the more recent reuses first.
         *
         * You can optionally insert HTML code inside the `<ods-reuses></ods-reuses>` element, in which case it will be used
         * as a template for each displayed reuse. The following variables are available in the template:
         * * `reuse.url: URL to the reuse's dataset page
         * * `reuse.title`: Title of the reuse
         * * `reuse.thumbnail`: URL to the thumbnail of the reuse
         * * `reuse.description`: Description of the reuse
         * * `reuse.created_at`: ISO datetime of reuse's original submission (can be used as `reuse.created_at|moment:'LLL'` to format it)
         * * `reuse.dataset.title`: Title of the reuse's dataset
         * * `reuse.user.last_name`: Last name of the reuse's submitter
         * * `reuse.user.first_name`: First name of the reuse's submitter
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-catalog-context context="paris" paris-domain="http://opendata.paris.fr">
         *              <ods-reuses context="paris"></ods-reuses>
         *          </ods-catalog-context>
         *      </file>
         *  </example>
         */
        return {
            restrict: 'E',
            replace: true,
            transclude: true,
            template: '<div class="odswidget odswidget-reuses">' +
                      '  <div infinite-scroll="loadMore()" infinite-scroll-distance="1">' +
                      '      <div class="odswidget-reuses__reuse" ng-repeat="reuse in reuses" ods-full-click inject>' +
                      '          <h2 class="odswidget-reuses__reuse-title">{{ reuse.title }}' +
                      '             <a href="/explore/dataset/{{ reuse.dataset.id }}/?tab=metas" class="odswidget-reuses__reuse-dataset-link" target="_self"><span translate>From dataset:</span> {{ reuse.dataset.title }}</a>' +
                      '          </h2>' +
                      '          <div class="odswidget-reuses__reuse-infos">' +
                      '              <div class="odswidget-reuses__reuse-thumbnail" ng-class="{\'odswidget-reuses__reuse-thumbnail--no-thumbnail\': !reuse.thumbnail}">' +
                      '                  <a ng-show="reuse.thumbnail" href="{{ reuse.url }}" ods-main-click title="{{ reuse.title }}" target="_blank"><img class="odswidget-reuses__reuse-thumbnail-image" ng-src="{{ reuse.thumbnail }}" /></a>' +
                      '                  <i ng-hide="reuse.thumbnail" class="fa fa-ban odswidget-reuses__reuse-thumbnail-image--no-thumbnail"></i>' +
                      '              </div>' +
                      '              <div class="odswidget-reuses__reuse-description" ng-bind-html="reuse.description|prettyText|safenewlines"></div>' +
                      '          </div>' +
                      '          <div class="odswidget-reuses__reuse-author">' +
                      '              <strong ng-if="reuse.user.first_name || reuse.user.last_name">{{ reuse.user.first_name }} {{ reuse.user.last_name }}</strong>' +
                      '              <strong ng-if="!reuse.user.first_name && !reuse.user.last_name">{{ reuse.user.username }}</strong>' +
                      '              <i class="fa fa-calendar odswidget-reuses__creation-icon"></i> {{ reuse.created_at|moment:\'LLL\' }}' +
                      '          </div>' +
                      '      </div>' +
                      ' </div>' +
                    '</div>',
            scope: {
                context: '='
            },
            controller: ['$scope', function($scope) {
                // Infinite scroll parameters
                var done = false;
                var fetching = false;
                var numberReuses = 0;
                var page = 1;
                var resultsPerPage = 20;

                $scope.reuses = [];

                $scope.loadMore = function() {
                    if ($scope.reuses.length && !done && !fetching) {
                        fetching = true;
                        var start = page * resultsPerPage;
                        ODSAPI.reuses($scope.context, {'rows': resultsPerPage, 'start': start}).
                            success(function(data) {
                                $scope.reuses = $scope.reuses.concat(data.reuses);
                                done = (page + 1) * resultsPerPage >= numberReuses;
                                page++;
                                fetching = false;
                            }).
                            error(function() {
                                fetching = false;
                            });
                    }
                };

                var refresh = function() {
                    fetching = true;
                    ODSAPI.reuses($scope.context, {'rows': resultsPerPage}).
                        success(function(data) {
                            $scope.reuses = data.reuses;
                            done = resultsPerPage >= data.nhits;
                            numberReuses = data.nhits;
                            fetching = false;
                        }).
                        error(function(data) {
                            fetching = false;
                        });
                };
                $scope.$watch('context', function() {
                    refresh();
                });
            }]
        };
    }]);

}());;(function() {
    'use strict';
    var mod = angular.module('ods-widgets');

    mod.directive('odsSearchbox', function() {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsSearchbox
         * @scope
         * @restrict E
         * @param {string} placeholder the text to display as a placeholder when the searchbox is empty
         * @param {CatalogContext} [context=none] {@link ods-widgets.directive:odsCatalogContext Catalog Context} indicating the domain to redirect the user to show the search results.
         * If none, the search is done on the local domain (/explore/ of the current domain the user is).
         * @description
         * This widget displays a wide searchbox that redirects the search on the Explore homepage of the domain.
         *
         */
        return {
            restrict: 'E',
            replace: true,
            template: '<div class="odswidget odswidget-searchbox">' +
                    '<form method="GET" action="{{ actionUrl }}" ng-if="actionUrl">' +
                    '<input class="odswidget-searchbox__box" name="q" type="text" placeholder="{{placeholder|translate}}">' +
                    '</form>' +
                '</div>',
            scope: {
                placeholder: '@',
                context: '='
            },
            controller: ['$scope', '$sce', function($scope, $sce) {
                $scope.actionUrl = '/explore/';

                var unwatch = $scope.$watch('context', function(nv) {
                    if (nv) {
                        $scope.actionUrl = $sce.trustAsResourceUrl($scope.context.domainUrl + $scope.actionUrl);
                        unwatch();
                    }
                });
            }]
        };
    });

}());;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsSocialButtons', [function() {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsSocialButtons
         * @scope
         * @restrict A
         * @param {string} addthisPubid Your AddThis account's public ID
         * @param {string} [buttons='google-plus,facebook,twitter'] Comma separated list of buttons you want to display.
         * @description
         * This widget displays a share button that on hover will reveal social media sharing buttons.
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-social-buttons addthis-pubid="myaddthispubid"></ods-social-buttons>
         *      </file>
         *  </example>
         */
        return {
            restrict: 'E',
            scope: {
                addthisPubid: '@',
                buttons: '@?'
            },
            replace: true,
            template: '' +
            '<div class="odswidget-social-buttons" ' +
            '     ng-init="displayButtons=false"' +
            '     ng-mouseenter="displayButtons=true" ng-mouseleave="displayButtons=false">' +
            '    <div class="odswidget-social-buttons__header">' +
            '        <span translate>Share</span>' +
            '        <i class="fa fa-angle-down"></i>' +
            '    </div>' +
            '    <div class="odswidget-social-buttons__buttons" ' +
            '         ng-class="{\'odswidget-social-buttons__buttons--open\': displayButtons}">' +
            '        <div class="addthis_toolbox addthis_counter_style">' +
            '            <a ng-if="selectedButtons.indexOf(\'facebook\') > -1" ' +
            '               class="addthis_button_facebook_like" fb:like:layout="box_count"></a>' +
            '            <a ng-if="selectedButtons.indexOf(\'twitter\') > -1" ' +
            '               class="addthis_button_tweet" tw:count="vertical"></a>' +
            '            <a ng-if="selectedButtons.indexOf(\'google-plus\') > -1" ' +
            '               class="addthis_button_google_plusone" g:plusone:size="tall"></a>' +
            '        </div>' +
            '    </div>'+
            '    <script type="text/javascript">' +
            '        var addthis_config = addthis_config || {};' +
            '        addthis_config.pubid = "{{ addthisPubid }}";' +
            '    </script>' +
            '    <script type="text/javascript" src=""></script>' +
            '</div>',
            link: function (scope) {
                // check buttons
                var availableButtons = ['google-plus', 'facebook', 'twitter'];
                scope.selectedButtons = availableButtons;
                if (angular.isDefined(scope.buttons)) {
                    var tmpButtons = scope.buttons.split(',').map(function (button) {return button.trim();});
                    scope.selectedButtons = [];
                    angular.forEach(tmpButtons, function (button) {
                        if (availableButtons.indexOf(button) > -1) {
                            scope.selectedButtons.push(button);
                        }
                    })
                }
                // load AddThis
                var addthis = document.createElement('script');
                addthis.type  = 'text/javascript';
                addthis.async = true;
                addthis.src   = '//s7.addthis.com/js/300/addthis_widget.js#domready=1';
                (document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0]).appendChild(addthis);
            }
        }
    }]);
})();
;(function () {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsSpinner', ['ODSWidgetsConfig', function (ODSWidgetsConfig) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsSpinner
         * @scope
         * @restrict E
         *
         * @description
         * This widget displays the custom OpenDataSoft spinner.
         * Its size and color match the current font's.
         * If the browser doesn't support svg animation via css, an animated gif will be displayed instead.
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-spinner></ods-spinner> Loading
         *      </file>
         *  </example>
         */
        return {
            restrict: 'E',
            replace: true,
            template: function () {
                if (Modernizr && Modernizr.cssanimations && Modernizr.svg) {
                    // Fallback to gif
                    return '' +
                        '<img src="' + ODSWidgetsConfig.basePath + 'src/img/spinner.gif" ' +
                        '     class="odswidget-spinner odswidget-spinner--gif"/>';
                }
                return '' +
                    '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" version="1.1"' +
                    '     class="odswidget-spinner odswidget-spinner--svg">' +
                    '    <rect x="0" y="0" width="30" height="30" class="odswidget-spinner__cell-11"></rect>' +
                    '    <rect x="35" y="0" width="30" height="30" class="odswidget-spinner__cell-12"></rect>' +
                    '    <rect x="70" y="0" width="30" height="30" class="odswidget-spinner__cell-13"></rect>' +
                    '    <rect x="0" y="35" width="30" height="30" class="odswidget-spinner__cell-21"></rect>' +
                    '    <rect x="35" y="35" width="30" height="30" class="odswidget-spinner__cell-22"></rect>' +
                    '    <rect x="70" y="35" width="30" height="30" class="odswidget-spinner__cell-23"></rect>' +
                    '    <rect x="0" y="70" width="30" height="30" class="odswidget-spinner__cell-31"></rect>' +
                    '    <rect x="35" y="70" width="30" height="30" class="odswidget-spinner__cell-32"></rect>' +
                    '    <rect x="70" y="70" width="30" height="30" class="odswidget-spinner__cell-33"></rect>' +
                    '</svg>';
            }
        }
    }]);
})();
;(function() {
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

}());;(function () {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsTagCloud', ['ODSAPI', '$location', function (ODSAPI, $location) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsTagCloud
         * @scope
         * @restrict E
         * @param {CatalogContext|DatasetContext} context
         *     {@link ods-widgets.directive:odsCatalogContext Catalog Context} or
         *     {@link ods-widgets.directive:odsDatasetContext Dataset Context} to use
         * @param {string} facetName Name of the facet to build the tag cloud from.
         * @param {number} [max=all] Maximum number of tags to show in the cloud.
         * @param {string} [redirectTo=none] URL.
         * If specified, a click on any tag will redirect to the given URL and apply the filter there.
         * @param {CatalogContext|DatasetContext} [contextToRefine=current context] Specify the context that will be
         * refined. If not specified at all, the refined context will be the one defined through the `context` parameter.
         *
         * @description
         * This widget displays a "tag cloud" of the values available in a facet (either the facet of a dataset, or a
         * facet from the dataset catalog). The "weight" (size) of a tag depends on the number of occurences ("count")
         * for this tag.
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-catalog-context context="catalog" catalog-domain="public.opendatasoft.com">
         *              <ods-tag-cloud context="catalog" facet-name="keyword"></ods-tag-cloud>
         *          </ods-catalog-context>
         *      </file>
         *  </example>
         */
        function median(facets) {
            var half = Math.floor(facets.length / 2);
            if (facets.length % 2) return facets[half].count;
            else return (facets[half - 1].count + facets[half].count) / 2.0;
        }

        function aggregateArrays(facets, median) {
            var array1 = $.grep(facets, function (value) {
                return value.count >= median;
            });
            var array2 = $.grep(facets, function (value) {
                return value.count <= median;
            });
            var obj = [
                {count: array1.length, min: array1[array1.length - 1].count, max: array1[0].count},
                {count: array2.length, min: array2[array2.length - 1].count, max: array2[0].count}
            ];
            obj[0].delta = obj[0].max - obj[0].min;
            obj[1].delta = obj[1].max - obj[1].min;
            return obj;
        }

        function getFacet(facet, median, aggregateArrays, domainUrl) {
            var delta = (facet.count >= median ? aggregateArrays[0].delta : aggregateArrays[1].delta) / 2;
            var weight;

            if (facet.count >= 2 * delta) {
                weight = 1;
            } else if (facet.count >= delta && facet.count < 2 * delta) {
                weight = 2;
            } else {
                weight = 3;
            }
            weight = facet.count >= median ? weight : weight + 3;

            facet = {
                count: facet.count,
                name: facet.name,
                opacity: ((((7 - weight) + 4) / 10) + 0.05).toFixed(2),
                size: ((7 - weight) / 3).toFixed(1),
                weight: weight
            };
            facet.size = weight !== 6 ? facet.size : parseFloat(facet.size) + 0.3;
            return facet;
        }

        function isContextRefined(context, facetName, tagName) {
            var refines = context.parameters['refine.' + facetName];
            return (angular.isDefined(refines) && (angular.isArray(refines) && refines.indexOf(tagName) > -1 || refines === tagName));
        }

        function shuffle(array) {
            for (var i = array.length - 1; i > 0; i--) {
                var j = Math.floor(Math.random() * (i + 1));
                var temp = array[i];
                array[i] = array[j];
                array[j] = temp;
            }
            return array;
        }

        return {
            restrict: 'E',
            replace: true,
            template: '' +
            '<div class="odswidget odswidget-tag-cloud">' +
            '    <ul class="odswidget-tag-cloud__tag-list">' +
            '        <li class="odswidget-tag-cloud__no-data-label" ng-hide="tags" translate>No data available yet</li>' +
            '        <li ng-repeat="tag in tags" ' +
            '            class="odswidget-tag-cloud__tag" ' +
            '            ng-class="{\'odswidget-tag-cloud__tag--selected\': tag.selected}"'+
            '            ng-style="{\'font-size\': tag.size + \'em\', \'opacity\': tag.opacity}">' +
            '            <a ng-click="refine(tag.name)" href="">' +
            '                {{ tag.name }}' +
            '            </a>' +
            '        </li>' +
            '    </ul>' +
            '</div>',
            scope: {
                context: '=',
                facetName: '@',
                max: '@?',
                redirectTo: '@?',
                contextToRefine: '=?'
            },
            controller: ['$scope', function ($scope) {
                $scope.refine = function (tagName) {
                    if ($scope.redirectTo) {
                        var refine_param = 'refine.' + $scope.facetName + '=' + tagName;
                        var join = $scope.redirectTo.indexOf('?') > -1 ? '&' : '?';
                        window.location = $scope.redirectTo + join + refine_param;
                    } else if ($scope.contextToRefine) {
                        $scope.contextToRefine.toggleRefine($scope.facetName, tagName);
                    } else {
                        $scope.context.toggleRefine($scope.facetName, tagName);
                    }
                };

                var refresh = function () {
                    var query;
                    var queryParams = {
                        'rows': 0,
                        'facet': $scope.facetName
                    };
                    if ($scope.context.type === 'catalog') {
                        query = ODSAPI.datasets.search($scope.context, queryParams);
                    } else {
                        queryParams = $.extend({}, $scope.context.parameters, queryParams);
                        query = ODSAPI.records.search($scope.context, queryParams);
                    }
                    query.success(function (data) {
                        if (data.facet_groups) {
                            $scope.tags = data.facet_groups[0].facets;
                            if ($scope.max) {
                                $scope.tags = $scope.tags.slice(0, $scope.max);
                            }
                            var m = median($scope.tags);
                            for (var i = 0; i < $scope.tags.length; i++) {
                                $scope.tags[i] = getFacet($scope.tags[i], m, aggregateArrays($scope.tags, m), $scope.context.domainUrl);
                                $scope.tags[i].selected = isContextRefined(
                                    $scope.contextToRefine ? $scope.contextToRefine : $scope.context,
                                    $scope.facetName,
                                    $scope.tags[i].name
                                );
                            }
                            $scope.tags = shuffle($scope.tags);
                        }
                    });
                };

                $scope.$watch('context', function (nv, ov) {
                    if ($scope.context.type === 'catalog' || $scope.context.type === 'dataset' && $scope.context.dataset) {
                        refresh();
                    }
                }, true);
            }]
        };
    }]);

}());;(function () {
    'use strict';
    var mod = angular.module('ods-widgets');

    mod.directive('odsTextSearch', function () {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsTextSearch
         * @scope
         * @restrict E
         * @param {string} placeholder the text to display as a placeholder when the searchbox is empty
         * @param {string} button the text to display in the "search" button
         * @param {string} [field=none] The name of a field you want to restrict the search on (i.e. only search on the
         * textual content of a specific field). If you want to specify different fields for each context, use the
         * syntax "mycontext-field". If you don't specify explicitely a field name for a context, it will default to the
         * value of the "field" parameter.
         * The search will be a simple text search and won't support any query language or operators.
         * @param {CatalogContext|DatasetContext|CatalogContext[]|DatasetContext[]} context {@link ods-widgets.directive:odsCatalogContext Catalog Context} or {@link ods-widgets.directive:odsDatasetContext Dataset Context} to use, or array of context to use.
         *
         * @description
         * This widget displays a search box that can be used to do a full-text search on a context.
         *
         *  @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-dataset-context context="cibul"
         *                               cibul-domain="public.opendatasoft.com"
         *                               cibul-dataset="evenements-publics-cibul">
         *              <ods-text-search context="cibul" field="title"></ods-text-search>
         *              <ods-table context="cibul"></ods-table>
         *          </ods-dataset-context>
         *     </file>
         * </example>
         *
         * Example with multiple contexts.
         *
         *  @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-dataset-context context="cibul,medecins"
         *                               cibul-domain="public.opendatasoft.com"
         *                               cibul-dataset="evenements-publics-cibul"
         *                               medecins-domain="public.opendatasoft.com"
         *                               medecins-dataset="donnees-sur-les-medecins-accredites">
         *              <ods-text-search context="[cibul,medecins]"
         *                               cibul-field="title"
         *                               medecins-field="libelle_long_de_la_specialite_du_medecin"></ods-text-search>
         *              <ods-table context="cibul"></ods-table>
         *              <ods-table context="medecins"></ods-table>
         *          </ods-dataset-context>
         *      </file>
         * </example>
         */
        return {
            restrict: 'E',
            replace: true,
            template: '' +
            '<div class="odswidget odswidget-text-search">' +
            '    <form ng-submit="applySearch()" class="odswidget-text-search__form">' +
            '        <input class="odswidget-text-search__search-box" name="q" type="text" ng-model="searchExpression" placeholder="{{ translatedPlaceholder }}">' +
            '        <button type="submit" class="odswidget-text-search__submit"><i class="fa fa-search"></i></button>' +
            '    </form>' +
            '</div>',
            scope: {
                placeholder: '@?',
                button: '@?',
                context: '=',
                field: '@?'
            },
            controller: ['$scope', '$attrs', 'translate', function ($scope, $attrs, translate) {
                var contexts = [];
                var fields = {};

                if (!angular.isArray($scope.context)) {
                    contexts.push($scope.context);
                } else {
                    contexts = $scope.context;
                }

                var unwatch = $scope.$watch('context', function (nv, ov) {
 
                    var parseParameter = function (context) {
                        var parameter = context.parameters.q;
                        if (!parameter) {
                            return;
                        }
 
                        var re = /([\w-_]+):"(.*)"/;
                        var matches = parameter.match(re);
                        if (matches && fields[context.name] === matches[1]) {
                            return matches[2];
                        }
                    };

                    if (nv) {
                        if (!angular.isArray(nv)) {
                            nv = [nv];
                        }
                        // parse fields
                        angular.forEach(nv, function (context) {
                            fields[context.name] = $attrs[context.name + 'Field'] || $scope.field;
                        });
 
                        // parse parameters
                        angular.forEach(nv, function (context) {
                            $scope.searchExpression = $scope.searchExpression || parseParameter(context)
                        });
                        if (!$scope.searchExpression) {
                            angular.forEach(nv, function (context) {
                                $scope.searchExpression = $scope.searchExpression || context.parameters.q;
                            });
                        }
                        unwatch();
                    }
                });

                var placeholderUnwatcher = $scope.$watch('placeholder', function (nv, ov) {
                    if (nv) {
                        $scope.translatedPlaceholder = translate($scope.placeholder);
                        placeholderUnwatcher();
                    }
                });

                $scope.applySearch = function () {
                    angular.forEach(contexts, function (context) {
                        if (fields[context.name] && $scope.searchExpression) {
                            context.parameters.q = fields[context.name] + ':"' + $scope.searchExpression + '"';
                        } else {
                            context.parameters.q = $scope.searchExpression;
                        }
                    });
                };
            }]
        };
    });

}());
;(function() {
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
            template: '' +
                '<div class="odswidget odswidget-theme-boxes">' +
                '   <div ng-repeat="item in items" class="odswidget-theme-boxes__box" ods-facet-results="items" ods-facet-results-context="context" ods-facet-results-facet-name="theme">' +
                '       <a ng-href="{{context.domainUrl}}/explore/?refine.theme={{encode(item.path)}}" target="_self" ods-tooltip="{{item.name}} ({{formatCount(item.count)}})" ods-tooltip-direction="bottom" style="display: block;">' +
                '           <ods-theme-picto class="odswidget-theme-boxes__picto" theme="{{item.name}}"></ods-theme-picto>' +
                '       </a>' +
                '   </div>' +
                '</div>',
            scope: {
                context: '='
            },
            controller: ['$scope', 'translate', function($scope, translate) {
                $scope.formatCount = function(count) {
                    // As it is very complicated to use ngPluralize with odsTooltip
                    if (count > 1) {
                        return count + ' ' + translate('datasets');
                    } else {
                        return count + ' ' + translate('dataset');
                    }
                };
                $scope.encode = encodeURIComponent;
            }]
        };
    });

}());;(function() {
    'use strict';
    var mod = angular.module('ods-widgets');

    mod.directive('odsTimerange', ['ModuleLazyLoader', function(ModuleLazyLoader) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsTimerange
         * @restrict E
         * @scope
         * @param {DatasetContext|DatasetContext[]} context {@link ods-widgets.directive:odsDatasetContext Dataset Context} or array of context to use
         * @param {string} [timeField=first date/datetime field available] Name of the field (date or datetime) to filter on
         * @param {string} [defaultFrom=none] Default datetime for the "from" field: either "yesterday", "now" or a string representing a date
         * @param {string} [defaultTo=none] Default datetime for the "to" field: either "yesterday", "now" or a string representing a date
         * @param {string} [displayTime=true] Define if the date selector displays the time selector as well
         * @param {string} [dateFormat='YYYY-MM-DD HH:mm'] Define the format for the date displayed in the inputs
         * @description
         * This widget displays two fields to select the two bounds of a date and time range.
         *
         *  @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-dataset-context context="cibul" cibul-domain="public.opendatasoft.com" cibul-dataset="evenements-publics-cibul">
         *              <ods-timerange context="cibul" default-from="yesterday" default-to="now"></ods-timerange>
         *              <ods-map context="cibul"></ods-map>
         *          </ods-dataset-context>
         *     </file>
         * </example>
         *
         * Example with multiple contexts set by ods-timerange
         *  @example
         *  <ods-dataset-context
         *          context="cibul,medecins"
         *          cibul-domain="public.opendatasoft.com"
         *          cibul-dataset="evenements-publics-cibul"
         *          medecins-domain="public.opendatasoft.com"
         *          medecins-dataset="donnees-sur-les-medecins-accredites">
         *      <ods-timerange context="[cibul,medecins]" default-from="yesterday" default-to="now"></ods-timerange>
         *      <ods-map context="cibul"></ods-map>
         *      <ods-map context="medecins"></ods-map>
         *  </ods-dataset-context>
         */
         // TODO merge controller with timescale
        var romeOptions = {
            styles: {
                container: "rd-container odswidgets-rd-container"
            },
            weekStart: 1
        };
        var computeDefaultTime = function(value) {
            if (value === 'yesterday') {
                return moment().subtract('days', 1);
            } else if (value === 'now') {
                return moment();
            } else if (angular.isString(value)) {
                return moment(value);
            } else {
                return null;
            }
        };
        var formatTimeToISO = function(time) {
            if (time) {
                return moment(time).milliseconds(0).toISOString().replace('.000Z', 'Z');
            } else {
                return null;
            }
        };

        return {
            restrict: 'E',
            replace: true,
            scope: {
                context: '=',
                timeField: '@?',
                defaultFrom: '@?',
                defaultTo: '@?',
                displayTime: '@?',
                dateFormat: '@?',
                to: '=?',
                from: '=?'
            },
            template: '<div class="odswidget odswidget-timerange">' +
                    '<span class="odswidget-timerange__from"><span translate>From</span> <input type="text"></span>' +
                    '<span class="odswidget-timerange__to"><span translate>to</span> <input type="text"></span>' +
                '</div>',
            link: function(scope, element, attrs) {
                var inputs = element.find('input');
                scope.dateFormat = scope.dateFormat || 'YYYY-MM-DD HH:mm';
                // Handle default values
                if (angular.isDefined(scope.defaultFrom)) {
                    inputs[0].value = computeDefaultTime(scope.defaultFrom).format(scope.dateFormat);
                    scope.from = formatTimeToISO(computeDefaultTime(scope.defaultFrom));
                }

                if (angular.isDefined(scope.defaultTo)) {
                    inputs[1].value = computeDefaultTime(scope.defaultTo).format(scope.dateFormat);
                    scope.to = formatTimeToISO(computeDefaultTime(scope.defaultTo));
                }

                ModuleLazyLoader('rome').then(function() {
                    if (typeof scope.displayTime === "undefined") {
                        scope.displayTime = true;
                    } else {
                        scope.displayTime = (scope.displayTime === "true");
                    }

                    rome(inputs[0], angular.extend({}, romeOptions, {
                        time: scope.displayTime,
                        dateValidator: rome.val.beforeEq(inputs[1]),
                        initialValue: scope.defaultFrom,
                        inputFormat: scope.dateFormat
                    })).on('data', function(value) {
                        scope.$apply(function() {
                            scope.from = formatTimeToISO(moment(value, scope.dateFormat));
                        });
                    });
                    rome(inputs[1], angular.extend({}, romeOptions, {
                        time: scope.displayTime,
                        dateValidator: rome.val.afterEq(inputs[0]),
                        initialValue: scope.defaultTo,
                        inputFormat: scope.dateFormat
                    })).on('data', function(value) {
                        scope.$apply(function() {
                            scope.to = formatTimeToISO(moment(value, scope.dateFormat));
                        });
                    });
                });
            },
            controller: ['$scope', '$attrs', '$q', '$compile', '$rootScope', '$parse', function($scope, $attrs, $q, $compile, $rootScope, $parse) {
                var contexts = [],
                    conf = {};

                // We need to gather the time field before applying our filter
                var getTimeField = function(dataset) {
                    if (dataset) {
                        var fields = dataset.fields.filter(function(item) { return item.type === 'date' || item.type === 'datetime'; });
                        if (fields.length > 1) {
                            console.log('Warning: the dataset "' + dataset.getUniqueId() + '" has more than one date or datetime field, the first date or datetime field will be used. You can specify the field to use using the "time-field" parameter.');
                        }
                        if (fields.length === 0) {
                            console.log('Error: the dataset "' + dataset.getUniqueId() + '" doesn\'t have any date or datetime field, which is required for the Timerange widget.');
                        }
                        return fields[0].name;
                    }
                    return null;
                };

                if (!angular.isArray($scope.context)) {
                    contexts.push($scope.context);
                    conf[$scope.context.name] = {};
                    if ($scope.timeField) {
                        conf[$scope.context.name]['timeField'] = $scope.timeField;
                    }
                } else {
                    contexts = $scope.context;
                }

                angular.forEach(contexts, function(context) {
                    conf[context.name] = {
                        timefield: conf[$scope.context.name] && conf[$scope.context.name]['timeField'] ? conf[$scope.context.name]['timeField'] : null,
                        formatter: $parse("$field + ':[' + $from + ' TO ' + $to + ']'"),
                        // formatter: $parse("$field"),
                        parameter: "q",

                    };

                    if (angular.isDefined($attrs[context.name + "ParameterFormatter"])) {
                        conf[context.name]['formatter'] = $parse($attrs[context.name + "ParameterFormatter"]);
                    }
                    if (angular.isDefined($attrs[context.name + "ParameterName"])) {
                        conf[context.name]['parameter'] = $attrs[context.name + "ParameterName"];
                    }
                    if (angular.isDefined($attrs[context.name + "TimeField"])) {
                        conf[context.name]['timefield'] = $attrs[context.name + "TimeField"];
                    }
                });

                $q.all(contexts.map(function(context) {
                    return context.wait().then(function(dataset) {
                        if (conf[context.name]['timefield'] === null) {
                            conf[context.name]['timefield'] = getTimeField(dataset);
                        }
                    });
                })).then(function() {
                    react(contexts, conf);
                });

                var react = function(contexts, configurations) {
                    $scope.$watch('[from, to]', function(nv) {
                        if (nv[0] && nv[1]) {
                            angular.forEach(contexts, function(context) {
                                var parameterName = configurations[context.name]['parameter'];
                                var evaluationScope = {};
                                evaluationScope.$to = $scope.to;
                                evaluationScope.$from = $scope.from;
                                evaluationScope.$field = configurations[context.name]['timefield'];
                                if (['q', 'rq'].indexOf(parameterName) > -1) {
                                    // Naming the parameter to prevent overwriting between widgets
                                    parameterName = parameterName + '.timerange';
                                }
                                context.parameters[parameterName] = configurations[context.name]['formatter'](evaluationScope);
                            });
                        }
                    }, true);
                };
            }]
        };
    }]);

}());
;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsTimescale', function() {
        /**
         *  @ngdoc directive
         *  @name ods-widgets.directive:odsTimescale
         *  @restrict E
         *  @scope
         *  @param {DatasetContext|DatasetContext[]} context {@link ods-widgets.directive:odsDatasetContext Dataset Context} or array of context to use
         *  @param {string=} [timeField=first date/datetime field available] Name of the field (date or datetime) to filter on
         *  @param {string=} [*TimeField=first date/datetime field available] For each context you can set the name of the field (date or datetime) to filter on
         *  @param {string=} [defaultValue=everything] Define the default timescale
         *  @description
         * Displays a control to select either:
         *
         * * last day
         *
         * * last week
         *
         * * last month
         *
         * * last year
         *
         *
         *  @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-dataset-context context="cibul" cibul-domain="public.opendatasoft.com" cibul-dataset="evenements-publics-cibul">
         *              <ods-timescale context="cibul" default-value="day"></ods-timescale>
         *              <ods-map context="cibul"></ods-map>
         *          </ods-dataset-context>
         *     </file>
         * </example>
         */
         // TODO merge controller with timerange
        return {
            restrict: 'E',
            replace: true,
            scope: {
                context: '=',
                timeField: '@',
                defaultValue: '@'
            },
            template: '' +
                '<div class="odswidget odswidget-timescale">' +
                '   <ul class="odswidget-timescale__scale-list">' +
                '       <li class="odswidget-timescale__scale" ng-class="{\'odswidget-timescale__scale--active\': scale == \'everything\' || !scale}"> <a class="odswidget-timescale__scale-link" href="#" ng-click="scale = \'everything\'; $event.preventDefault();" translate>Everything</a></li>' +
                '       <li class="odswidget-timescale__scale" ng-class="{\'odswidget-timescale__scale--active\': scale == \'year\'}">                 <a class="odswidget-timescale__scale-link" href="#" ng-click="scale = \'year\'; $event.preventDefault();" translate>Last 12 months</a></li>' +
                '       <li class="odswidget-timescale__scale" ng-class="{\'odswidget-timescale__scale--active\': scale == \'month\'}">                <a class="odswidget-timescale__scale-link" href="#" ng-click="scale = \'month\'; $event.preventDefault();" translate>Last 4 weeks</a></li>' +
                '       <li class="odswidget-timescale__scale" ng-class="{\'odswidget-timescale__scale--active\': scale == \'week\'}">                 <a class="odswidget-timescale__scale-link" href="#" ng-click="scale = \'week\'; $event.preventDefault();" translate>Last 7 days</a></li>' +
                '       <li class="odswidget-timescale__scale" ng-class="{\'odswidget-timescale__scale--active\': scale == \'day\'}">                  <a class="odswidget-timescale__scale-link" href="#" ng-click="scale = \'day\'; $event.preventDefault();" translate>Last 24 hours</a></li>' +
                '   </ul>' +
                '</div>',
            controller: ['$scope', '$attrs', '$q', function($scope, $attrs, $q) {
                var contexts = [];
                var timeFields = {};
                var parameterName = 'q.timescale';

                // We need to gather the time field before applying our filter
                var setTimeField = function(dataset) {
                    if (dataset) {
                        var fields = dataset.fields.filter(function(item) { return item.type === 'date' || item.type === 'datetime'; });
                        if (fields.length > 1) {
                            console.log('Warning: the dataset "' + dataset.getUniqueId() + '" has more than one date or datetime field, the first date or datetime field will be used. You can specify the field to use using the "time-field" parameter.');
                        }
                        if (fields.length === 0) {
                            console.log('Error: the dataset "' + dataset.getUniqueId() + '" doesn\'t have any date or datetime field, which is required for the Timerange widget.');
                        }
                        timeFields[dataset.getUniqueId()] = fields[0].name;
                    }
                };

                if (!angular.isArray($scope.context)) {
                    contexts.push($scope.context);
                } else {
                    contexts = $scope.context;
                }

                $q.all(contexts.map(function(context) {
                    return context.wait().then(function(dataset) {
                        if (angular.isDefined($attrs[context.name + "TimeField"])) {
                            timeFields[context.dataset.getUniqueId()] = $attrs[context.name + "TimeField"];
                        } else if ($scope.timeField) {
                            timeFields[context.dataset.getUniqueId()] = $scope.timeField;
                        } else {
                            setTimeField(dataset);
                        }
                    });
                })).then(function() {
                    react(contexts, timeFields);
                });

                var react = function(contexts, timeFields) {
                    $scope.scale = $scope.defaultValue || 'everything';
                    $scope.$watch('scale', function(scale) {
                        if (scale === 'everything') {
                            angular.forEach(contexts, function(context) {
                                delete context.parameters[parameterName];
                            });
                            return;
                        }
                        var q = null;
                        var now = new Date();
                        if (scale === 'day') {
                            now.setDate(now.getDate()-1);
                        } else if (scale === 'week') {
                            now.setDate(now.getDate()-7);
                        } else if (scale === 'month') {
                            now.setMonth(now.getMonth()-1);
                        } else if (scale === 'year') {
                            now.setFullYear(now.getFullYear()-1);
                        }
                        q = now.toISOString();

                        angular.forEach(contexts, function(context) {
                            context.parameters[parameterName] = timeFields[context.dataset.getUniqueId()] + '>="' + q + '"';
                        });
                    }, true);
                };
            }]
        };
    });

}());
;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsToggleModel', function() {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsToggleModel
         * @restrict A
         * @scope
         * @param {Object} odsToggleModel Object to apply the toggle on
         * @param {string} odsToggleKey The key that holds the toggled value
         * @param {string} odsTogglValue The toggled value
         * @param {string} [odsStoreAs=array] The type of the resulting variable. Either 'array' or 'csv'.
         * @description
         * This widget, when used on a checkbox, allows the checkbox to be used to "toggle" a value in an object, in other words to add it or remove when the checkbox
         * is respectively checked and unchecked. Multiple checkboxes can be used on the same model and key, in which case if two or more are toggled, an array
         * will be created to hold the values.
         *
         * @example
         *  <pre>
         *      <ods-catalog-context context="catalog" catalog-domain="public.opendatasoft.com">
         *
         *          <input type="checkbox" ods-toggle-model="catalog.parameters" ods-toggle-key="refine.publisher" ods-toggle-value="Government">
         *          <input type="checkbox" ods-toggle-model="catalog.parameters" ods-toggle-key="refine.publisher" ods-toggle-value="World Bank">
         *
         *      </ods-catalog-context>
         *  </pre>
         *
         */

        var enable = function(obj, key, value) {
            if (obj[key]) {
                if (angular.isArray(obj[key])) {
                    if (obj[key].indexOf(value) < 0) {
                        obj[key].push(value);
                    }
                } else {
                    if (!angular.equals(obj[key], value)) {
                        obj[key] = [obj[key], value];
                    }
                }
            } else {
                obj[key] = value;
            }
        };

        var disable = function(obj, key, value) {
            if (obj[key]) {
                if (angular.isArray(obj[key])) {
                    if (obj[key].indexOf(value) >= 0) {
                        if (obj[key].length === 1) {
                            delete obj[key];
                        } else {
                            obj[key].splice(obj[key].indexOf(value), 1);
                        }
                    }
                } else {
                    if (angular.equals(obj[key], value)) {
                        delete obj[key];
                    }
                }
            }
        };

        var convertModelToArray = function (obj, key) {
            if (typeof obj[key] === 'string') {
                obj[key] = obj[key].split(',');
            }
        };

        var convertModelToStorageFormat = function (obj, key, storeAs) {
            if (storeAs == 'csv' && angular.isArray(obj[key])) {
                obj[key] = obj[key].join(',');
            }
        };

        return {
            restrict: 'A',
            scope: {
                odsToggleModel: '=',
                odsToggleKey: '@',
                odsToggleValue: '@',
                odsStoreAs: '@?'
            },
            link: function(scope, element, attrs) {
                if (!angular.isDefined(scope.odsStoreAs) || ['array', 'csv'].indexOf(scope.odsStoreAs) == -1) {
                    scope.odsStoreAs = 'array';
                }
                element.on('change', function(e) {
                    var checked = e.currentTarget.checked;
                    if (checked) {
                        // Toggle ON
                        scope.$apply(function() {
                            convertModelToArray(scope.odsToggleModel, scope.odsToggleKey);
                            enable(scope.odsToggleModel, scope.odsToggleKey, scope.odsToggleValue);
                            convertModelToStorageFormat(scope.odsToggleModel, scope.odsToggleKey, scope.odsStoreAs);
                        });
                    } else {
                        // Toggle OFF
                        scope.$apply(function() {
                            convertModelToArray(scope.odsToggleModel, scope.odsToggleKey);
                            disable(scope.odsToggleModel, scope.odsToggleKey, scope.odsToggleValue);
                            convertModelToStorageFormat(scope.odsToggleModel, scope.odsToggleKey, scope.odsStoreAs);
                        });
                    }
                });

                scope.$watch('odsToggleModel[odsToggleKey]', function(nv) {
                    if (nv) {
                        if ((angular.isArray(nv) && nv.indexOf(scope.odsToggleValue) >= 0)
                            || (!angular.isArray(nv) && nv.split(',').indexOf(scope.odsToggleValue)>=0)) {
                            // Check
                            element.prop('checked', true);
                        } else if (angular.equals(nv, scope.odsToggleValue)) {
                            // Check
                            element.prop('checked', true);
                        } else {
                            // Uncheck
                            element.prop('checked', false);
                        }
                    } else {
                        // Uncheck
                        element.prop('checked', false);
                    }
                }, true);
            }
        };
    });
}());;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsTopPublishers', ['ODSAPI', function(ODSAPI) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsTopPublishers
         * @scope
         * @restrict E
         * @param {CatalogContext} context {@link ods-widgets.directive:odsCatalogContext Catalog Context} to use
         * @description
         * This widget displays the 5 top publishers
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-catalog-context context="public" public-domain="public.opendatasoft.com">
         *              <ods-top-publishers context="public"></ods-top-publishers>
         *          </ods-catalog-context>
         *      </file>
         *  </example>
         */
        return {
            restrict: 'E',
            replace: true,
            template: '<div class="odswidget odswidget-top-publishers">' +
                '<ul class="odswidget-top-publishers__publishers">' +
                '   <li class="no-data" ng-hide="publishers" translate>No data available yet</li>' +
                '   <li class="odswidget-top-publishers__publisher" ng-repeat="publisher in publishers" ng-if="publishers">' +
                '       <div class="odswidget-top-publishers__publisher-details">' +
                '           <div class="odswidget-top-publishers__publisher-details-name"><a ng-href="{{ context.domainUrl }}/explore/?refine.publisher={{ publisher.path }}" target="_self">{{ publisher.name }}</a></div>' +
                '           <div class="odswidget-top-publishers__publisher-details-count"><i class="fa fa-table"></i> <span translate translate-n="publisher.count" translate-plural="Used by {{$count}} datasets">Used by {{$count}} dataset</span></div>' +
                '       </div>' +
                '   </li>' +
                '</ul>' +
                '</div>',
            scope: {
                context: '='
            },
            controller: ['$scope', function($scope) {
                var refresh = function() {
                    ODSAPI.datasets.facets($scope.context, 'publisher').
                        success(function(data) {
                            $scope.publishers = data.facet_groups[0].facets.slice(0, 5);
                        });
                };
                $scope.$watch('context', function() {
                    refresh();
                });
            }]
        };
    }]);

}());;(function () {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsTwitterTimeline', function () {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsTwitterTimeline
         * @restrict E
         * @scope
         * @param {string} widgetId The identifier of the Twitter widget you want to integrate. See https://twitter.com/settings/widgets for more information.
         * @param {number} [width=300] Forces the width of the Twitter timeline widget.
         * @param {number} [height=600] Forces the height of the Twitter timeline widget.
         * @description
         * Integrates a Twitter "widget" using the widget ID provided by Twitter.
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-twitter-timeline widget-id="502475045042544641"></ods-twitter-timeline>
         *      </file>
         *  </example>
         */
        return {
            restrict: 'E',
            replace: true,
            template: '<div class="odswidget"></div>',
            scope: {
                'widgetId': '@'
            },
            link: function (scope, element, attrs) {
                var html = '' +
                    '<a class="twitter-timeline" ' +
                    '   href="https://twitter.com/twitterapi" ' +
                    '   data-widget-id="' + attrs.widgetId + '"';
                if (attrs.height) {
                    html += '   height="' + attrs.height + '"';
                }
                if (attrs.width) {
                    html += '   width="' + attrs.width + '"';
                }
                html +=
                    '   >Tweets</a>' +
                    '<script>!function(d,s,id){var js,fjs=d.getElementsByTagName(s)[0];if(!d.getElementById(id)){js=d.createElement(s);js.id=id;js.src="//platform.twitter.com/widgets.js";fjs.parentNode.insertBefore(js,fjs);}}(document,"script","twitter-wjs");</script>';
                element.append(html);
            }
        };
    });
}());;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('inject', function(){
        // Thank you petebacondarwin: https://github.com/angular/angular.js/issues/7874#issuecomment-47647003
        return {
            link: function($scope, $element, $attrs, controller, $transclude) {
                var innerScope = $scope.$new();
                if (!$transclude) {
                    console.warn("inject directive used on an element with no transcluded directives", $element);
                    return;
                }
                $transclude(innerScope, function(clone) {
                    var testClone = clone.clone();
                    testClone.contents().wrapAll('<div>');
                    if (testClone.contents().length > 0 && testClone.contents().html().trim().length > 0) {
                        // Only do that if there is content to use. That way, we can keep the HTML inside the element
                        // that has the inject directive, and use it as a "default" template if there is nothing to transclude.
                        $element.empty();
                        $element.append(clone);
                        $element.on('$destroy', function () {
                            innerScope.$destroy();
                        });
                    }
                });
            }
        };
    });

    mod.directive('odsFullClick', function(){
        return {
            restrict: 'A',
            link: function(scope, element, attrs) {
                if (attrs.odsFullClick) {
                    element.find('[ods-main-click]').attr('href', attrs.odsFullClick);
                }
                element.click(function(evt){
                    if (!$(evt.target).is('a,button,[ng-click]') && // The element is not a link in itself
                        ($(evt.target).parents('a,button,[ng-click]').length === 0) && // The element is not within a clickable element
                        element.find('[ods-main-click]').length) {
                        if (document.createEvent){
                            // Web Browsers
                            // you cannot redispatch an existing event :(
                            var cloneEvent = document.createEvent('MouseEvents');
                            var e = evt.originalEvent;
                            cloneEvent.initMouseEvent(e.type, e.bubbles, e.cancelable, window, e.detail,
                                e.screenX, e.screenY, e.clientX, e.clientY, e.ctrlKey, e.altKey, e.shiftKey,
                                e.metaKey, e.button, e.relatedTarget);

                            element.find('[ods-main-click]')[0].dispatchEvent(cloneEvent);
                        } else if (document.createEventObject){
                            // IE
                            // This should be the proper way to do it, but it doesn't work :/
                            // element.find('[main-click]')[0].fireEvent('onclick', document.createEventObject())
                            window.location = element.find('[ods-main-click]')[0].href;
                        }
                    }
                });
            }
        };
    });
}());;(function() {
    'use strict';

    var mod = angular.module('ods-widgets');

    mod.directive('odsWidgetTooltip', ['$rootScope', '$compile', function($rootScope, $compile) {
        /**
         * @ngdoc directive
         * @name ods-widgets.directive:odsWidgetTooltip
         * @restrict A
         * @transclude
         *
         * @description
         * This directive is a helper for displaying custom tooltip.
         * It allows to configure the usable fields in the tooltip and the template and does the html rendering giving
         * back the compiled html to the calling widget.
         * By default the template for the custom tooltip can access the record and a `displayedFields` array that lists
         * the record fields that should appear in the tooltip.
         *
         * @example
         *  <example module="ods-widgets">
         *      <file name="index.html">
         *          <ods-dataset-context context="stations" stations-domain="public.opendatasoft.com" stations-dataset="jcdecaux_bike_data">
         *              <ods-media-gallery context="stations" ods-widget-tooltip>
         *                  <h3>My custom tooltip</h3>
         *                  {{ getRecordTitle(record) }}
         *              </ods-media-gallery>
         *          </ods-dataset-context>
         *      </file>
         *  </example>
         */
        return {
            restrict: 'A',
            priority: 100,
            transclude: true,
            controller: ['$scope', '$element', '$attrs', '$transclude', function($scope, $element, $attrs, $transclude) {
                var template,
                    displayedFields,
                    fields,
                    that = this;

                this.configure = function(options) {
                    template = options.defaultTemplate || '';
                    displayedFields = options.displayedFields || [];
                    fields = options.fields || [];
                };

                this.render = function(record, scopeCustomAttributes, currentField) {
                    var compiledTemplate,
                        newScope = $rootScope.$new(true);

                    newScope.record = angular.copy(record);
                    newScope.displayedFields = angular.copy(displayedFields);
                    newScope.fields = angular.copy(fields);

                    if (currentField) {
                        newScope.displayedFields =  newScope.displayedFields.filter(function(field) {
                            return currentField !== field.name;
                        });
                    }

                    angular.merge(newScope, scopeCustomAttributes || {});

                    if (!template) {
                        $transclude($rootScope.$new(true), function(clone, scope) {
                            if (clone.length > 0) {
                                template = clone;
                            } else {
                                template = that.defaultTemplate;
                            }
                        });
                    }

                    compiledTemplate = $compile(template);

                    return compiledTemplate(newScope);
                }
            }]
        };
    }]);
}());
