import { ChangeDetectionStrategy, Component } from '@angular/core';

// Placeholder (FND-05). Real page: TPL-02.
@Component({
  selector: 'tp-templates-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h1>Шаблоны недель</h1>`,
})
export class TemplatesPage {}
