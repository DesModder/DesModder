// https://stackoverflow.com/a/9517879
// injects script.ts into the correct window context
export default function injectScript(url: string) {
  const s = document.createElement("script");
  s.src = url;
  s.onload = function () {
    // remove the script so it doesn't appear in the DOM tree
    s.remove();
  };
  const head = document.head || document.documentElement;
  if (head !== null) {
    head.appendChild(s);
  }
}
