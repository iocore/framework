'use strict';

import bodyParser   from 'body-parser';
import * as ioCoreBootstrap  from 'iocore/core/bootstrap';
import * as constants  from 'iocore/core/constants';

export class Bootstrap extends ioCoreBootstrap.Bootstrap {

    init() {
        console.log('Installing body parser');
        //this.container.app.use(bodyParser.json());
		//this.container.app.use(bodyParser.urlencoded({ extended: false }));
    }

    onKernelEventsSubscribe()
    {
        let eventsMap = {};

        eventsMap[constants.KERNEL_EVENT_EXPRESS_READY] = {
            priority: constants.PRIORITY_NORMAL,
            callback: () => {
                this.init();
            }
        };

        return eventsMap;
    }
}
