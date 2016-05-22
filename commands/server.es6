import { BaseCommand } from 'iocore/commands/base';

export class ServerCommand extends BaseCommand {

    /**
     * Bootstrap and listen
     */
    run()
    {
        this.container.bootstrap().listen(
            (httpSettings) => {
                this.log(`HTTP Server started on ${httpSettings.host}:${httpSettings.port}`);
            },

            (httpsSettings) => {
                this.log(`HTTPS Server started on ${httpsSettings.host}:${httpsSettings.port}`);
            }
        );
    }
}
