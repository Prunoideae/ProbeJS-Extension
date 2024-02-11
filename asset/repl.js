//@ts-check
(function () {
    // @ts-ignore
    const vscode = acquireVsCodeApi();

    const replContainer = document.querySelector('.repl-container');
    const input = document.querySelector('#repl-input');
    const scriptType = document.querySelector('#scriptType');
    const scriptPacks = document.querySelector('#scriptPack');

    if (replContainer === null || input === null || scriptType === null || scriptPacks === null) {
        return;
    }

    /**
     * @param {string} input
     */
    function pushInput(input) {
        const div = document.createElement('div');
        div.classList.add('repl-input');
        div.textContent = input;
        replContainer?.appendChild(div);
    }

    /**
     * @param {string} output
     */
    function pushOutput(output) {
        const div = document.createElement('div');
        div.classList.add('repl-output');
        div.textContent = output;
        replContainer?.appendChild(div);
    }

    /**
     * @type {Record<string, (args: any) => void>}
     */
    const commands = {
        clear: () => {
            replContainer.innerHTML = '';
        },
        output: (args) => {
            pushOutput(args);
        }
    };

    /**
     * @type {Map<string, [(arg:any)=>void, (arg:any)=>void]>}
     */
    const promises = new Map();

    window.addEventListener('message', event => {
        const message = event.data;
        if (message.command) {
            let { command, payload } = message;
            if (command in commands) {
                commands[command](payload);
            }
        }
        //@ts-expect-error
        const [promise, reject] = promises.get(message.id);
        if (promise && message.payload) {
            promise(message.payload);
            promises.delete(message.id);
        }
        if (reject && message.error) {
            reject(message.error);
            promises.delete(message.id);
        }
    });

    /**
     * @param {string} command 
     * @param {any} payload 
     * @returns {Promise<any>}
     */
    function invoke(command, payload) {
        const id = Math.random().toString(36).substring(2, 15);
        const promise = new Promise((resolve, reject) => {
            promises.set(id, [resolve, reject]);
        });
        vscode.postMessage({
            command,
            payload,
            id
        });
        return promise;
    }

    input.addEventListener('keydown', event => {
        //@ts-expect-error
        if (event.key === 'Enter') {
            event.preventDefault();
            //@ts-expect-error
            const value = input.value;
            //@ts-expect-error
            input.value = '';
            pushInput(value);

            invoke('evaluate', {
                input: value,
                // @ts-expect-error
                type: scriptType?.value,
                // @ts-expect-error
                pack: scriptPacks?.value
            })
                .catch(error => {
                    pushOutput(error);
                    //@ts-expect-error
                    input.focus();
                    //scroll window to bottom
                    window.scrollTo(0, document.body.scrollHeight);
                })
                .then(output => {
                    pushOutput(output);
                    //@ts-expect-error
                    input.focus();
                    //scroll window to bottom
                    window.scrollTo(0, document.body.scrollHeight);
                });
        }
    });

    scriptType?.addEventListener('change', event => {
        // clean up the scriptPacks
        scriptPacks.innerHTML = '';
        //@ts-expect-error
        scriptPacks.value = '';

        // clean up the replContainer
        replContainer.innerHTML = '';

        //@ts-expect-error
        invoke('getPacks', event.target.value).then(
            /**
             * @param {string[]} packs
             */
            packs => {
                packs.forEach(pack => {
                    const option = document.createElement("vscode-option");
                    //@ts-expect-error
                    option.value = pack;
                    option.textContent = pack;
                    scriptPacks.appendChild(option);
                });
            });
        //@ts-expect-error
        pushOutput('Script type changed to ' + event.target.value);
    });

    scriptPacks?.addEventListener('change', event => {
        // clean up the replContainer
        replContainer.innerHTML = '';

        //@ts-expect-error
        pushOutput('Script pack changed to ' + event.target.value);
    });

    pushOutput('Welcome to the ProbeJS REPL!');
}());