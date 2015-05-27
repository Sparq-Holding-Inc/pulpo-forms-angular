var app = angular.module('survey-question');

app.factory('VersionService', function($resource){
    var version_api_url = '/dynamicForms/visor/publishVersion/';

    return $resource( version_api_url +':form/', 
        {form:'@form'},
        {'query': {method: 'GET', isArray: true }});
});
