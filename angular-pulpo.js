'use strict';

/**
 *
 * 
 */

 angular
  .module('pulpoForm', [
    'ngResource',
    'ngSanitize',
    'ui.bootstrap',
    'checklist-model',
    'udpCaptcha',
    'ngResource',
    'angularFileUpload',
    'survey-question'
  ]);

angular.module('pulpoForm')
	.config(['$locationProvider','$httpProvider', function ($locationProvider, $httpProvider) {

    $locationProvider.html5Mode({
  		enabled: true,
  		requireBase: false
		});
    $httpProvider.defaults.xsrfCookieName = 'csrftoken';
		$httpProvider.defaults.xsrfHeaderName = 'X-CSRFToken';

  }]);

angular.module('pulpoForm')
	.directive('validate', function() {
    return {
      require: 'ngModel',
      link: function(scope, elm, attrs, ctrl) {
        ctrl.$validators.validate = function(modelValue, viewValue) {
		      if (ctrl.$isEmpty(modelValue)) {
            // Consider empty models to be valid
            return true;
          }
          var validator = validatorFactory.getValidator(attrs.fieldtype);
            if (validator){
              if (validator.validate(viewValue, attrs)) {
                return true;
              }
	            return false;
            } else {
              return true;
                  }
              };
          }
        };
    });