import { AbstractControl, ValidationErrors } from '@angular/forms';
export function atLeastOneContact(control:AbstractControl):ValidationErrors|null{return control.get('phone')?.value||control.get('email')?.value?null:{contact:true}}
