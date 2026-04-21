import { TuiButton, TuiRoot } from "@taiga-ui/core";
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'edo-dogx-root',
  imports: [RouterOutlet, TuiRoot, TuiButton],
  template: `
  <tui-root>
    <ng-container ngProjectAs="tuiOverContent">
      	<button
    size="l"
    tuiButton
    type="button"
>
    Large
</button>
      <router-outlet />
    </ng-container>
  </tui-root>
  `,
})
export class AppComponent { }
