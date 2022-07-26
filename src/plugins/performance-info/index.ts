import { Calc } from "globals/window";

let dispatchListenerID: string

export default {
    id: "performance-info",
    name: "Performance Display",
    description: "Displays information about the performance of the current graph.",
    onEnable: () => {
        dispatchListenerID = Calc.controller.dispatcher.register((e) => {
            if (e.type === "on-evaluator-changes") {
                console.log(e)
            }
        })
    },
    onDisable: () => {
        Calc.controller.dispatcher.unregister(dispatchListenerID)
    },
    enabledByDefault: false,
} as const;