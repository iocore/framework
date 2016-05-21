import { BaseCommand } from 'iocore/commands/base';

export class ServerCommand extends BaseCommand {

    /**
     * Bootstrap and listen
     */
    run()
    {
        this.log('Running server');
        this.container.bootstrap().listen();
    }
}
