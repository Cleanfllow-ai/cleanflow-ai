// Generic mock for lucide-react ESM icon files used by next/jest after the
// modularizeImports SWC rewrite turns `import { Pencil } from "lucide-react"`
// into `import { default as Pencil } from "lucide-react/dist/esm/icons/pencil"`.
// jest can't parse the ESM file, so we redirect every icon path here.
// Also serves as the bare `lucide-react` mock for named imports — the Proxy
// returns the same component for every accessed key so any icon name resolves.
const React = require("react");
const Icon = React.forwardRef(function LucideIconMock(props, ref) {
  return React.createElement("svg", { ref, ...props });
});
const handler = {
  get(target, prop) {
    if (prop === "default" || prop === "__esModule") return prop === "default" ? Icon : true;
    return target[prop] !== undefined ? target[prop] : Icon;
  },
};
const proxied = new Proxy(Icon, handler);
module.exports = proxied;
module.exports.default = Icon;
