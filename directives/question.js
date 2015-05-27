var scripts = document.getElementsByTagName("script")
var currentScriptPath = scripts[scripts.length-1].src;
angular.module('survey-question', ['ui.bootstrap','checklist-model', 'udpCaptcha','angularFileUpload'])
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
    }).directive('dsSurvey', function(){
        return {
          restrict: 'E',
          templateUrl: currentScriptPath.replace('question.js', 'survey-template.html'),
          controller: SurveyController,
          scope: {
            slug: "@slug",
          },
          link: function(scope, element, attrs){

          }
        };
    }).directive('showQuestion', function(){
        return {
          restrict: 'E',
          templateUrl: currentScriptPath.replace('question.js', 'question-template.html'),
          controller: ShowQuestionController,
          transclude: true,
          scope: {
            question: "=question",
          },
          link: function(scope, element, attrs){

          }
        };
    });


function SurveyController($scope, $filter, $http, $window, $captcha,
                            VersionService){
    var visor = $scope;
        
    visor.loadmaps = [];
        
    visor.disableSubmit = true;
    
    visor.enviarCaptcha = function(resultado){
        if($captcha.checkResult(resultado) === true){
            visor.disableSubmit = false;
        } else {
            visor.disableSubmit = true;
        }
    };

    visor.loadmap = function(field){
        var map, lat, lon;
        if (visor.loadmaps[field.field_id] === undefined){
            if (field.answer[0] === undefined){
                lat = field.mapXY.latitude;
                field.answer[0] = lat;
            } else {
                lat = field.answer[0];
            }
            if (field.answer[1] === undefined){
                lon = field.mapXY.longitude;
                field.answer[1] = lon;
            } else {
                lon = field.answer[1];
            }
            var options = {
                zoom: 8,
                center: new google.maps.LatLng(lat, lon)
            };
            map = new google.maps.Map(document.getElementById(field.field_id),
            options);
            var oneLatLng = new google.maps.LatLng(lat, lon);
            var one = new google.maps.Marker({
            position: oneLatLng,
            map: map,
            draggable: true
        });
        visor.loadmaps[field.field_id] = true;
        google.maps.event.addListener(one, 'dragend', function(evento) {
            var la = evento.latLng.lat();
            var lo = evento.latLng.lng();
            field.answer=[la,lo];
            });
        }
    };

    visor.plugin_mode = false;
    if (instance){
        visor.plugin_mode = true;
    }

    visor.base_url = base_url;
    if (!visor.base_url){
        visor.base_url = '';
    }

    if (instance){
        visor.slug = instance;
    }

    // Load last published Version
    visor.load = function(){
        VersionService.get({form: visor.slug},
            function(version){
                delete version.$promise;
                delete version.$resolved;
                visor.setFormValues(version);
            }, function(error){
                alert('Error loading version: ' + error.data.error);
            });
    };

    // Call load function
    visor.load();

    visor.setFormValues = function(data){
        visor.version = data;
        visor.disableSubmit = visor.version.captcha;
        visor.pages = JSON.parse(data.json).pages;
        visor.logic = JSON.parse(data.json).logic;
        visor.after_submit = JSON.parse(data.json).after_submit;
        visor.initialiceConditions();
        visor.changePage(0);
        visor.selectPage(0);
    };

    visor.pre_save = function(){
        visor.submitting = true;
        visor.questions = [];
        var i;
        for (i = 0; i< visor.pages.length; i++) {
            visor.questions = visor.questions.concat(angular.copy(visor.pages[i].fields));
        }
        for ( i = 0; i < visor.questions.length; i++) { 
            if (visor.questions[i].field_type === 'CheckboxField'){
                var respuesta = '';
                 for ( var x = 0; x < visor.questions[i].options.length-1; x++){
                    respuesta += visor.questions[i].options[x].id + '#';
                 }
                respuesta += visor.questions[i].options[visor.questions[i].options.length-1].id;
                visor.questions[i].options = respuesta;
            } else if (visor.questions[i].field_type === 'SelectField'){
                visor.questions[i].options = visor.questions[i].options.join('#');
            }
            if (visor.questions[i].field_type != 'FileField'){
                visor.questions[i].answer = visor.questions[i].answer.join('#');
            } else if(visor.questions[i].field_type === 'FileField' && visor.questions[i].answer.length===0){
                visor.questions[i].answer = '';
            }
        }
        for (var j = 0; j < visor.questions.length; j++) {
            var pageNum = visor.getPageNumByFieldId(visor.questions[j].field_id);
            visor.questions[j].shown = Boolean(visor.showValues[visor.questions[j].field_id] && visor.showPageValues[pageNum]);
            delete visor.questions[j].tooltip;
            if (visor.questions[j].options){
                delete visor.questions[j].options;
            }
            if (visor.questions[j].dependencies){
                delete visor.questions[j].dependencies;
            }
        }
    };

    visor.dataMedia = new FormData();

    // Persist form
    visor.save = function(){
        visor.pre_save();
        $http({
            method: 'POST',
            url: visor.base_url+'visor/submit/'+visor.slug+'/',
            headers: { 'Content-Type': undefined},
            transformRequest:function (data) {
                data.append('data', angular.toJson(visor.questions));
                return data; 
            },
            data:visor.dataMedia
        }).success( function(data, status, headers, config){
            if(visor.after_submit.action === 'Redirect To'){
                $window.location.href = visor.after_submit.redirect;
            } else {
                $window.location.href = 'visor/form/submitted/'+visor.slug+'/';
            }
        })
        .error(function(data, status, headers, config) {
            alert('Error saving data: ' + data.error);
            visor.submitting = false;
        });
    };

    // Page navegation

    visor.changePage = function(page){
        visor.selectPage(page);
    };

    visor.selectPage = function(page){
        visor.selectedPage = visor.pages[page];
        visor.selectedPageNum = page;
    };

    visor.getNext = function(){
        var next = visor.selectedPageNum + 1;
        while (next < visor.pages.length && !visor.showPageValues[next]){
            next++;
        }
        if (next === visor.pages.length){
            return -1;
        } else {
            return next;
        }
    };

    visor.getPrevious = function(){
        var prev = visor.selectedPageNum - 1;
        while (prev >= 0 && !visor.showPageValues[prev]){
            prev--;
        }
        return prev;
    };
   
    visor.canNext = function(){
        var canNext = false;
        if (visor.pages){
            var next = visor.getNext();
            canNext = (next != -1);
        }
        return canNext;
    };

    visor.next = function(){
        var next = visor.getNext();
        if (next != -1){
            visor.changePage(next);
        }
    };

    visor.canPrevious = function(){
        var canPrevious = false;
        if (visor.pages){
            var prev = visor.getPrevious();
            canPrevious = (prev != -1);
        }
        return canPrevious;
    };

    visor.previous = function(){
        var prev = visor.getPrevious();
        if (prev != -1){
            visor.changePage(prev);
        }
    };

      /********************/
     /* Logic evaluation */
    /********************/

    visor.showValues = [];
    visor.showPageValues = [];

    visor.initialiceConditions = function(){
        visor.questions = [];
        for (var i = 0; i < visor.pages.length; i++) {
            visor.questions = visor.questions.concat(angular.copy(visor.pages[i].fields));
            visor.evaluatePageCondition(i);
        }
        for (var j = 0; j < visor.questions.length; j++){
            var field = visor.questions[j];
            visor.evaluateCondition(field.field_id);
        }
    };

    visor.updateDependencies = function(field_id){
        var field_org = visor.getFieldById(field_id);
        var field_dst;
        for (var k = 0; k < field_org.dependencies.fields.length; k++){
            field_dst = visor.getFieldById(field_org.dependencies.fields[k]);
            visor.evaluateCondition(field_dst.field_id);
        }
        for (var j = 0; j < field_org.dependencies.pages.length; j++){
            visor.evaluatePageCondition(field_org.dependencies.pages[j]);
        }
    };

    visor.evaluateCondition = function(field_id){
        var logic = visor.logic.fields[field_id];
        var condition, field_org, data, operator, funcStr;
        if (logic){
            var value = true;
            if (logic.action === 'All'){
                value = true;
                for (var condAll in logic.conditions){
                    condition = logic.conditions[condAll];
                    field_org = visor.getFieldById(condition.field);
                    data = field_org.answer;
                    operator = eval('operatorFactory.getOperator("'+condition.field_type+'")');
                    funcStr = 'operator.'+ condition.comparator +'("'+data+'","'+ condition.value+'")';
                    value &= eval(funcStr);
                }
            }
            if (logic.action === 'Any'){
                value = false;
                for (var condAny in logic.conditions){
                    condition = logic.conditions[condAny];
                    field_org = visor.getFieldById(condition.field);
                    data = field_org.answer;
                    operator = eval('operatorFactory.getOperator("'+condition.field_type+'")');
                    funcStr = 'operator.'+ condition.comparator +'("'+data+'","'+ condition.value+'")';
                    value |= eval(funcStr);
                }
            }
            if (logic.operation === 'Show'){
                visor.showValues[field_id] = value;
            } else {
                visor.showValues[field_id] = !value;
            }
        } else {
            visor.showValues[field_id] = 1;
        }
    };

    visor.evaluatePageCondition = function(pageNum){
        var logic = visor.logic.pages[pageNum];
        var condition, field_org, data, operator, funcStr;
        if (logic){
            var value = true;
            if (logic.action === 'All'){
                value = true;
                for (var condAll in logic.conditions){
                    condition = logic.conditions[condAll];
                    field_org = visor.getFieldById(condition.field);
                    data = field_org.answer; 
                    operator = eval('operatorFactory.getOperator("'+condition.field_type+'")');
                    funcStr = 'operator.'+ condition.comparator +'("'+data+'","'+ condition.value+'")';
                    value &= eval(funcStr);
                }
            }
            if (logic.action == 'Any'){
                value = false;
                for (var condAny in logic.conditions){
                    condition = logic.conditions[condAny];
                    field_org = visor.getFieldById(condition.field);
                    data = field_org.answer;
                    operator = eval('operatorFactory.getOperator("'+condition.field_type+'")');
                    funcStr = 'operator.'+ condition.comparator +'("'+data+'","'+ condition.value+'")';
                    value |= eval(funcStr);
                }
            }
            if (logic.operation == 'Show'){
                visor.showPageValues[pageNum] = value;
            } else {
                visor.showPageValues[pageNum] = !value;
            }
        } else {
            visor.showPageValues[pageNum] = 1;
        }
    };

      /**********************/
     /* Auxiliar functions */
    /**********************/

     visor.onFileSelect = function($files,fileModel) {
        // $files: an array of files selected, each file has name, size, and type.
        var file = $files[0]; 
        var file_id = file.name;
        visor.dataMedia.append(file_id,file);
        fileModel.answer = file_id;
    };

    visor.fileName = function(name){
        if(JSON.stringify(name) == "[]")
            return "";
        return name;
    };

    // Precondition: Field with field_id === id exists
    visor.getFieldById = function(id){
        for(var i = 0; i < visor.pages.length; i++){
            var page = visor.pages[i];
            for(var j = 0; j < page.fields.length; j++){
                var field = page.fields[j];
                if(field.field_id == id){
                    return field;
                }
            }
        }
    };

    // Precondition: Field with field_id === id exists
    visor.getPageNumByFieldId = function(id){
        for(var i = 0; i < visor.pages.length; i++){
            var page = visor.pages[i];
            for(var j = 0; j < page.fields.length; j++){
                var field = page.fields[j];
                if(field.field_id == id){
                    return i;
                }
            }
        }
    };
}

function ShowQuestionController($scope, $filter){
    $scope.showValues = $scope.$parent.showValues;
    $scope.showPageValues = $scope.$parent.showPageValues;

    var visor = $scope;

    visor.loadmap = function(field){
        var map, lat, lon;
        if (visor.$parent.loadmaps[field.field_id]==undefined){
            if (field.answer[0] == undefined){
                lat = field.mapXY.latitude;
                field.answer[0] = lat;
            } else {
                lat = field.answer[0];
            }
            if (field.answer[1] == undefined){
                lon = field.mapXY.longitude;
                field.answer[1] = lon;
            } else {
                lon = field.answer[1];
            }
            var options = {
                zoom: 8,
                center: new google.maps.LatLng(lat, lon)
            };
            map = new google.maps.Map(document.getElementById(field.field_id),
            options);
            var oneLatLng = new google.maps.LatLng(lat, lon);
            var one = new google.maps.Marker({
            position: oneLatLng,
            map: map,
            draggable: true
        });
        visor.$parent.loadmaps[field.field_id]= true;
        google.maps.event.addListener(one, 'dragend', function(evento) {
            var la = evento.latLng.lat();
            var lo = evento.latLng.lng();
            field.answer=[la,lo];
            });
        }
    };

      /********************/
     /* Logic evaluation */
    /********************/
    visor.updateDependencies = function(field_id){
        var field_org = visor.getFieldById(field_id);
        var field_dst;
        for (var k = 0; k < field_org.dependencies.fields.length; k++){
            field_dst = visor.getFieldById(field_org.dependencies.fields[k]);
            visor.evaluateCondition(field_dst.field_id);
        }
        for (var j = 0; j < field_org.dependencies.pages.length; j++){
            visor.evaluatePageCondition(field_org.dependencies.pages[j]);
        }
    };

    visor.evaluateCondition = function(field_id){
        var logic = visor.$parent.logic.fields[field_id];
        var condition, field_org, data, operator, funcStr;
        if (logic){
            var value = true;
            if (logic.action == 'All'){
                value = true;
                for (var condAll in logic.conditions){
                    condition = logic.conditions[condAll];
                    field_org = visor.getFieldById(condition.field);
                    data = field_org.answer;
                    operator = eval('operatorFactory.getOperator("'+condition.field_type+'")');
                    funcStr = 'operator.'+ condition.comparator +'("'+data+'","'+ condition.value+'")';
                    value &= eval(funcStr);
                }
            }
            if (logic.action == 'Any'){
                value = false;
                for (var condAny in logic.conditions){
                    condition = logic.conditions[condAny];
                    field_org = visor.getFieldById(condition.field);
                    data = field_org.answer;
                    operator = eval('operatorFactory.getOperator("'+condition.field_type+'")');
                    funcStr = 'operator.'+ condition.comparator +'("'+data+'","'+ condition.value+'")';
                    value |= eval(funcStr);
                }
            }
            if (logic.operation == 'Show'){
                    $scope.$parent.showValues[field_id] = value;
                } else {
                    $scope.$parent.showValues[field_id] = !value;
                }
        } else {
            $scope.$parent.showValues[field_id] = 1;
        }
    };

    visor.evaluatePageCondition = function(pageNum){
        var logic = visor.$parent.logic.pages[pageNum];
        var condition, field_org, data, operator, funcStr;
        if (logic){
            var value = true;
            if (logic.action == 'All'){
                value = true;
                for (var condAll in logic.conditions){
                    condition = logic.conditions[condAll];
                    field_org = visor.getFieldById(condition.field);
                    data = field_org.answer; 
                    operator = eval('operatorFactory.getOperator("'+condition.field_type+'")');
                    funcStr = 'operator.'+ condition.comparator +'("'+data+'","'+ condition.value+'")';
                    value &= eval(funcStr);
                }
            }
            if (logic.action == 'Any'){
                value = false;
                for (var condAny in logic.conditions){
                    condition = logic.conditions[condAny];
                    field_org = visor.getFieldById(condition.field);
                    data = field_org.answer;
                    operator = eval('operatorFactory.getOperator("'+condition.field_type+'")');
                    funcStr = 'operator.'+ condition.comparator +'("'+data+'","'+ condition.value+'")';
                    value |= eval(funcStr);
                }
                
            }
            if (logic.operation == 'Show'){
                visor.showPageValues[pageNum] = value;
            } else {
                visor.showPageValues[pageNum] = !value;
            }
        } else {
            visor.showPageValues[pageNum] = 1;
        }
    };
        
        
      /**********************/
     /* Auxiliar functions */
    /**********************/
    
     visor.onFileSelect = function($files,fileModel) {
        // $files: an array of files selected, each file has name, size, and type.
        var file = $files[0]; 
        var file_id = file.name;
        visor.$parent.dataMedia.append(file_id,file);
        fileModel.answer = file_id;
    };
    
    visor.fileName = function(name){
        if(JSON.stringify(name) == "[]")
            return "";
        return name;
    };

    // Precondition: Field with field_id === id exists
    visor.getFieldById = function(id){
        for(var i = 0; i < visor.$parent.pages.length; i++){
            var page = visor.$parent.pages[i];
            for(var j = 0; j < page.fields.length; j++){
                var field = page.fields[j];
                if(field.field_id == id){
                    return field;
                }
            }
        }
    };

    // Precondition: Field with field_id === id exists
    visor.getPageNumByFieldId = function(id){
        for(var i = 0; i < visor.pages.length; i++){
            var page = visor.pages[i];
            for(var j = 0; j < page.fields.length; j++){
                var field = page.fields[j];
                if(field.field_id == id){
                    return i;
                }
            }
        }
    };

}