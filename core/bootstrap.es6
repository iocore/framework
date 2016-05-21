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
     *      return {
     *          constants.KERNEL_EVENT_MODULES_REGISTERED: {
     *              priority: constants.PRIORITY_NORMAL,
     *              callback: (arg1, arg2, ...args) -> {
     *                  // Do here whatever you want
     *              }
     *          }
     *      }
     *
     * @returns Object
     */
    onKernelEventsSubscribe()
    {
        return {};
    }
}
