# pulpo-forms-angular
Angular directive to render [Pulpo Forms](https://github.com/pulpocoders/pulpo-forms-django) dynamic forms. 

## Installation
Install angular-pulpo through bower:
```
  bower install angular-pulpo
```

## Example Usage
Include the sources in you templates and use the Pulpo directive to render your form using the form's slug (which you can check in the Pulpo Forms Django dashboard)
```
<div class="container" style="padding: 0px">
        <ds-survey slug="form_slug"></dsSurvey>
</div>
```
