'use strict';

import * as ioCore  from 'iocore/core/bootstrap';
import * as constants  from 'iocore/core/constants';
let cookieParser = require('cookie-parser');

export class Bootstrap extends ioCore.Bootstrap {

    init() {
        console.log('Installing cookie parser');
        this.container.app.use(cookieParser());
    }

    onKernelEventsSubscribe()
    {
        let eventsMap = {};

        eventsMap[constants.KERNEL_EVENT_EXPRESS_READY] = {
            priority: constants.PRIORITY_NORMAL,
            callback: () => {
                this.init()
            }
        };

        return eventsMap;
    }
}
