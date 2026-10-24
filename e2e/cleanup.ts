import { cleanup } from "./seed";

cleanup().then(() => console.log("removed test restaurants and users")).catch((e) => { console.error(e); process.exit(1); });
