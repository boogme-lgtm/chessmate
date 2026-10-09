/**
 * Stand-in for the `trpc` React client in page render tests
 * (renderToStaticMarkup). Every `trpc.<router>.<procedure>.useQuery()` returns
 * an idle, empty result and every `.useMutation()` an idle mutation, unless
 * `overrides` supplies that procedure's hooks (keyed "router.procedure").
 * `useUtils()` returns a proxy on which every call is a no-op, so pages can
 * render with only the data a test cares about.
 */

type Hooks = {
  useQuery?: (...args: any[]) => unknown;
  useMutation?: (...args: any[]) => unknown;
};

const noop = () => {};

const idleQuery = () => ({
  data: undefined,
  isLoading: false,
  isFetching: false,
  isError: false,
  error: null,
  refetch: noop,
});

const idleMutation = () => ({
  mutate: noop,
  mutateAsync: async () => undefined,
  isPending: false,
  reset: noop,
});

/** utils.<anything>.<anything>(...) → undefined, at any depth. */
function noopUtils(): any {
  return new Proxy(noop, {
    get: (_target, prop) => (prop === "then" ? undefined : noopUtils()),
    apply: () => undefined,
  });
}

export function createTrpcStub(overrides: Record<string, Hooks> = {}): any {
  return new Proxy(
    {},
    {
      get(_target, router) {
        if (router === "useUtils" || router === "useContext") return () => noopUtils();
        return new Proxy(
          {},
          {
            get(_t, procedure) {
              const hooks = overrides[`${String(router)}.${String(procedure)}`] ?? {};
              return {
                useQuery: hooks.useQuery ?? idleQuery,
                useMutation: hooks.useMutation ?? idleMutation,
              };
            },
          },
        );
      },
    },
  );
}
