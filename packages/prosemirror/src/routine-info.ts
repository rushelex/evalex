import type { FormulaRoutine, FormulaRoutineParameter, FormulaRoutineSignature } from 'evalex';

import { typeText } from './type-text';

/**
 * Shows each routine as its argument lists with what they return, then its description; `argument` marks the
 * argument the caret is in, the last one of a list where it repeats.
 */
export function routineInfo({ routines, argument }: { routines: readonly FormulaRoutine[]; argument?: number }): HTMLElement {
  const dom = element({ className: 'pm-formula-routines' });

  for (const routine of routines) {
    const signatures = routine.signatures.length > 0 ? routine.signatures.map((signature) => signatureLine({ routine, signature, argument })) : [element({ className: 'pm-formula-signature', text: `${routine.name}(…)` })];

    dom.append(...signatures, element({ className: 'pm-formula-description', text: routine.description }));
  }

  return dom;
}

function signatureLine({ routine, signature: { subject, parameters, returns }, argument }: { routine: FormulaRoutine; signature: FormulaRoutineSignature; argument?: number }): HTMLElement {
  const line = element({ className: 'pm-formula-signature' });
  const active = argument === undefined ? -1 : activeIndex({ parameters, argument });

  line.append(`${subject ? `${typeText(subject)}.` : ''}${routine.name}(`);
  parameters.forEach((parameter, index) => {
    line.append(...(index > 0 ? [', '] : []), index === active ? element({ tag: 'span', className: 'pm-formula-argument-active', text: parameterText(parameter) }) : parameterText(parameter));
  });
  line.append(`): ${typeText(returns)}`);

  return line;
}

function activeIndex({ parameters, argument }: { parameters: readonly FormulaRoutineParameter[]; argument: number }): number {
  if (argument < parameters.length) {
    return argument;
  }

  return parameters.at(-1)?.repeatable ? parameters.length - 1 : -1;
}

/** `places` for a required argument, `[places]` for an optional one, `numbers…` for one that repeats. */
function parameterText({ name, optional, repeatable }: FormulaRoutineParameter): string {
  const text = repeatable ? `${name}…` : name;

  return optional ? `[${text}]` : text;
}

function element({ tag = 'div', className, text }: { tag?: 'div' | 'span'; className: string; text?: string }): HTMLElement {
  const dom = document.createElement(tag);

  dom.className = className;

  if (text !== undefined) {
    dom.textContent = text;
  }

  return dom;
}
