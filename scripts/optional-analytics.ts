import { loadEnv, type Plugin } from "vite";

// VITE settings are public build inputs. Preview must never emit an analytics tag,
// even when a caller accidentally supplies otherwise valid analytics settings.
export function optionalAnalyticsPlugin(): Plugin {
  let endpoint = "";
  let websiteId = "";

  return {
    name: "optional-analytics",
    configResolved(config) {
      const appEnv = loadEnv(config.mode, config.envDir, "APP_ENV").APP_ENV;
      endpoint = config.env.VITE_ANALYTICS_ENDPOINT?.trim() ?? "";
      websiteId = config.env.VITE_ANALYTICS_WEBSITE_ID?.trim() ?? "";

      if (
        appEnv === "preview" ||
        !endpoint ||
        !websiteId ||
        /%VITE_[^%]+%/.test(endpoint + websiteId)
      ) {
        endpoint = "";
        return;
      }

      try {
        const url = new URL(endpoint, "https://analytics.invalid");
        if (
          (!endpoint.startsWith("/") && !/^https?:\/\//i.test(endpoint)) ||
          !["http:", "https:"].includes(url.protocol) ||
          url.username ||
          url.password ||
          url.search ||
          url.hash
        )
          endpoint = "";
      } catch {
        endpoint = "";
      }
    },
    transformIndexHtml: {
      order: "post",
      handler() {
        if (!endpoint) return;
        return [
          {
            tag: "script",
            attrs: {
              defer: true,
              src: `${endpoint.replace(/\/+$/, "")}/umami`,
              "data-website-id": websiteId,
            },
            injectTo: "body",
          },
        ];
      },
    },
  };
}
