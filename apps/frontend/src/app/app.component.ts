import { TuiRoot } from '@taiga-ui/core';
import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'edo-dogx-root',
  imports: [RouterOutlet, TuiRoot],
  template: `
  <tui-root>
    <router-outlet />
  </tui-root>
  `,
})
export class AppComponent {}
