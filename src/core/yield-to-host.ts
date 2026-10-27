/**
 * Resolves in a new task, after the host has run the tasks already queued, such as input and rendering.
 *
 * @remarks
 * A message on a channel is a task of its own without the minimum delay browsers add to nested timers, so work split
 * into many short slices does not stretch.
 */
export async function yieldToHost(): Promise<void> {
  return new Promise((resolve) => {
    const { port1, port2 } = new MessageChannel();

    port1.addEventListener('message', () => {
      port1.close();
      resolve();
    }, { once: true });
    // A listener added this way gets messages only once the port starts.
    port1.start();
    port2.postMessage(undefined);
  });
}
