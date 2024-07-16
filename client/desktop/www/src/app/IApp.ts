/**
 * @license     BSL 1.1 (subject to the terms defined in the project's LICENSE file)
 * @copyright   (c) 2023, John Brandle
 */

import type { AppModel } from './model/AppModel.ts';
import type { ProgressModal } from './components/modal/ProgressModal.ts';
import type { ToastNotification } from './components/notification/ToastNotification.ts';
import type { IBaseApp } from '../library/IBaseApp.ts';
import type { BridgeManager } from './managers/BridgeManager.ts';
import type { DownloadManager } from './managers/DownloadManager.ts';
import type { UserManager } from './managers/UserManager.ts';
import type { WalletManager } from './managers/WalletManager.ts';
import type { ContextMenuManager } from './managers/ContextMenuManager.ts';
import type { InstanceManager } from './managers/InstanceManager.ts';
import type { NetworkManager } from './managers/NetworkManager.ts';
import type { ObservableManager } from './managers/ObservableManager.ts';
import type { PerformanceManager } from './managers/PerformanceManager.ts';
import type { BannerNotification } from './components/notification/BannerNotification.ts';
import type { IEnvironment } from './IEnvironment.ts';
import type { DataUtil } from './utils/DataUtil.ts';
import type { DialogUtil } from './utils/DialogUtil.ts';
import type { FileSystemUtil } from './utils/FileSystemUtil.ts';
import type { PDFUtil } from './utils/PDFUtil.ts';
import type { QRCodeUtil } from './utils/QRCodeUtil.ts';
import type { APIUtil } from '../../../../../shared/src/app/utils/APIUtil.ts';
import type { TOTPUtil } from '../../../../../shared/src/app/utils/TOTPUtil.ts';
import type { UploadUtil } from '../../../../../shared/src/app/utils/UploadUtil.ts';

export const IAppType = Symbol("IApp");

export interface IApp<A extends IApp<A>> extends IBaseApp<A>
{    
    get model():AppModel<A>;
    get progressModal():ProgressModal<A>;
    get toastNotification():ToastNotification<A>;
    get bannerNotification():BannerNotification<A>;

    get contextMenuManager():ContextMenuManager<A>;
    get instanceManager():InstanceManager<A>;
    get networkManager():NetworkManager<A>;
    get observableManager():ObservableManager<A>;
    get performanceManager():PerformanceManager<A>;

    get userManager():UserManager<A>;
    get walletManager():WalletManager<A>;
    get bridgeManager():BridgeManager<A>;
    get downloadManager():DownloadManager<A>;

    get environment():IEnvironment;

    get dataUtil():DataUtil<A>;
    get dialogUtil():DialogUtil<A>;
    get fileSystemUtil():FileSystemUtil<A>;
    get pdfUtil():PDFUtil<A>;
    get qrCodeUtil():QRCodeUtil<A>;

    get apiUtil():APIUtil<A>;
    get totpUtil():TOTPUtil<A>;
    get uploadUtil():UploadUtil<A>;
}