import {
    provideVSCodeDesignSystem,
    vsCodeButton,
    vsCodeTextField,
    vsCodeDropdown,
    vsCodeOption,
    vsCodeDivider,
} from "@vscode/webview-ui-toolkit";
provideVSCodeDesignSystem().register(
    vsCodeButton(),
    vsCodeTextField(),
    vsCodeDropdown(),
    vsCodeOption(),
    vsCodeDivider()
);
