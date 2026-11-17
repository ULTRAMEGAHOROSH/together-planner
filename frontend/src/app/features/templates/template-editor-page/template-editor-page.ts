import { Component, input } from '@angular/core';

// Placeholder (FND-05). Real page: TPL-04.
@Component({
  selector: 'tp-template-editor-page',
  template: `
    <h1>Шаблон</h1>
    <p>{{ templateId() ?? 'Новый шаблон' }}</p>
  `,
})
export class TemplateEditorPage {
  readonly templateId = input<string>();
}
