import * as constants from 'constants';
import * as path from 'path';

export class Bootstrap {

    /**
     * Container is core instance
     *
     * @param container ioCore
     */
    constructor(container) {
        this.container = container;
    }

    /**
     * Subscribing to all the kernel events in one place.
     * Subscription can be delegated here
     *
     * Example of subscribing:
     *
     *      let eventsMap = {};

            eventsMap[constants.KERNEL_EVENT_EXPRESS_READY] = {
                priority: constants.PRIORITY_NORMAL,
                callback: () => {
                    this.init();
                }
            };

            return eventsMap;
     *
     * @returns Object
     */
    onKernelEventsSubscribe()
    {
        return {};
    }
}
