export class Config {
    private static readonly interactiveKey = "Should ProbeJS Open the Websocket for VSCode Evaluation? 1 - enabled, others - disabled.";
    private static readonly portKey = "Which port should ProbeJS listen on for VSCode Extension?";
    private static readonly enabledKey = "Should ProbeJS be Generally Enabled";

    public static fromData(data: any): Config {
        return new Config(
            data[Config.enabledKey],
            data[Config.interactiveKey],
            data[Config.portKey],
        );
    }

    private constructor(
        public enabled: boolean,
        public interactiveMode: number,
        public port: number,
    ) { }

    public overwrite(data: any): any {
        data[Config.enabledKey] = this.enabled;
        data[Config.interactiveKey] = this.interactiveMode;
        data[Config.portKey] = this.port;
        return data;
    }

    /**
     * Checks if the configuration is valid for ProbeJS to start REPL.
     * 
     * As old configuration will not have these fields.
     * 
     * @returns true if the configuration is valid
     */
    public isInteractiveValid(): boolean {
        return this.interactiveMode !== undefined && this.port !== undefined;
    }
}