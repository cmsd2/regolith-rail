import { parseArgs } from "node:util";
import { checkLinks } from "../src/links.ts";

const { values } = parseArgs({
  options: {
    dir: { type: "string", default: "packages/app/build/client" },
    base: { type: "string", default: "/" },
  },
});

const broken = checkLinks(values.dir, values.base);
if (broken.length > 0) {
  console.error(`found ${broken.length} broken link(s):`);
  for (const link of broken) console.error(`- ${link.page}: ${link.href} (${link.reason})`);
  process.exit(1);
}
console.log(`all links in ${values.dir} resolve`);
