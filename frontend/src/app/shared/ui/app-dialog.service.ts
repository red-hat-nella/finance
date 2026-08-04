import { Component, Inject, Injectable } from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { firstValueFrom } from 'rxjs';

export interface ConfirmDialogData {
  readonly title: string;
  readonly message: string;
  readonly confirmLabel: string;
}

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content
      ><p>{{ data.message }}</p></mat-dialog-content
    >
    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="close(false)">Cancelar</button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        (click)="close(true)"
      >
        {{ data.confirmLabel }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      p {
        max-width: 52ch;
        overflow-wrap: anywhere;
      }
      button {
        min-width: 88px;
        min-height: 44px;
      }
    `,
  ],
})
export class ConfirmDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) readonly data: ConfirmDialogData,
    private readonly ref: MatDialogRef<ConfirmDialogComponent, boolean>,
  ) {}

  close(value: boolean): void {
    this.ref.close(value);
  }
}

@Injectable({ providedIn: 'root' })
export class AppDialogService {
  constructor(private readonly dialog: MatDialog) {}

  async confirm(
    message: string,
    title = 'Confirmar acción',
    confirmLabel = 'Confirmar',
  ): Promise<boolean> {
    const result = await firstValueFrom(
      this.dialog
        .open(ConfirmDialogComponent, {
          width: 'min(480px, calc(100vw - 32px))',
          maxWidth: '480px',
          autoFocus: 'first-tabbable',
          restoreFocus: true,
          disableClose: false,
          data: { title, message, confirmLabel } satisfies ConfirmDialogData,
        })
        .afterClosed(),
    );
    return result === true;
  }
}
