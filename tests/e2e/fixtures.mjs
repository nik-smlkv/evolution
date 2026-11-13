import { test as base } from "@playwright/test";

export { expect } from "@playwright/test";

export const test = base.extend({
  localNetwork: [
    async ({ context, baseURL }, use) => {
      const localOrigin = new URL(baseURL).origin;
      await context.route("**/*", (route) => {
        const url = new URL(route.request().url());
        return url.origin === localOrigin ? route.continue() : route.abort("blockedbyclient");
      });
      await use();
    },
    { auto: true },
  ],
});
