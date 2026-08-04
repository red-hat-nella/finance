import { AbstractControl, ValidationErrors } from '@angular/forms';
export function colombianDocument(control:AbstractControl):ValidationErrors|null { const value=String(control.value??'').trim(); return /^[A-Za-z0-9]{5,20}$/.test(value)?null:{document:true}; }
