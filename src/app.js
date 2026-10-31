import React from 'react';
import { createRuntime } from './runtime.js';
import Component from './logic.js';
import template from './template.html';

export function createApp(document, initialRoute, props = {}) {
  const runtime = createRuntime(document);
  runtime.markFetched('Teyvat');
  runtime.registry.get('Teyvat').Logic = Component;
  runtime.updateHtml('Teyvat', template);
  return React.createElement(runtime.getDC('Teyvat'), { initialRoute, ...props });
}
