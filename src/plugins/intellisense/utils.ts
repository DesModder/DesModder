export const pendingIntellisenseTimeouts = new Set<number>();
export const setIntellisenseTimeout = function (
  handler: () => void,
  timeout?: number
) {
  const thisInvocationID = window.setTimeout(() => {
    handler();
    pendingIntellisenseTimeouts.delete(thisInvocationID);
  }, timeout);
  pendingIntellisenseTimeouts.add(thisInvocationID);
};
