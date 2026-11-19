import { Plugin } from "@opencode/plugin";

/**
 * The Workerd runtime cannot run a local shell or edit a local checkout.
 * Never pretend to expose desktop tools or grant them permissions implicitly.
 * GitHub edits must be implemented separately with scoped, authenticated tools.
 */
export default Plugin.define({
  id: "w1-workerd-tools",
  async setup(ctx) {
    await ctx.tool.transform((tools) => {
      for (const name of ["read", "write", "edit", "patch", "glob", "grep", "shell"]) {
        tools.remove(name);
      }
    });
  },
});
