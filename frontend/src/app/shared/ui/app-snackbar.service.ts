import { Injectable } from '@angular/core';
import {
  MatSnackBar,
  MatSnackBarRef,
  TextOnlySnackBar,
} from '@angular/material/snack-bar';

@Injectable({ providedIn: 'root' })
export class AppSnackbarService {
  constructor(private readonly snack: MatSnackBar) {}

  show(message: string): MatSnackBarRef<TextOnlySnackBar> {
    return this.snack.open(message, 'Cerrar', {
      duration: 5000,
      horizontalPosition: 'end',
      politeness: 'polite',
    });
  }
}
