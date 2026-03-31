(function () {
    function pageLoaded() {
        if (document.readyState === "complete") {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            window.addEventListener("load", resolve, { once: true });
        });
    }

    function probeAsset(url) {
        return new Promise((resolve) => {
            const startedAt = performance.now();
            const probe = new Image();
            const finalize = () => resolve(performance.now() - startedAt);

            probe.onload = finalize;
            probe.onerror = finalize;
            probe.src = url + (url.includes("?") ? "&" : "?") + "v=" + Date.now();
        });
    }

    async function estimateLoaderTiming() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        let minDurationMs = 850;
        let maxWaitMs = 2600;

        if (connection) {
            if (connection.saveData) {
                minDurationMs = 650;
                maxWaitMs = 2200;
            }

            switch (connection.effectiveType) {
                case "slow-2g":
                    minDurationMs = 1700;
                    maxWaitMs = 3400;
                    break;
                case "2g":
                    minDurationMs = 1450;
                    maxWaitMs = 3000;
                    break;
                case "3g":
                    minDurationMs = 1100;
                    maxWaitMs = 2800;
                    break;
                case "4g":
                default:
                    minDurationMs = 800;
                    maxWaitMs = 2400;
                    break;
            }

            if (typeof connection.downlink === "number") {
                if (connection.downlink >= 10) {
                    minDurationMs = Math.min(minDurationMs, 700);
                } else if (connection.downlink <= 1.5) {
                    minDurationMs = Math.max(minDurationMs, 1350);
                }
            }

            if (typeof connection.rtt === "number" && connection.rtt > 600) {
                minDurationMs = Math.max(minDurationMs, 1500);
            }
        }

        try {
            const probeTime = await probeAsset("img/logo.png");

            if (probeTime < 120) {
                minDurationMs = Math.min(minDurationMs, 700);
            } else if (probeTime < 260) {
                minDurationMs = Math.min(Math.max(minDurationMs, 850), 950);
            } else if (probeTime < 700) {
                minDurationMs = Math.max(minDurationMs, 1100);
            } else {
                minDurationMs = Math.max(minDurationMs, 1500);
                maxWaitMs = Math.max(maxWaitMs, 3200);
            }
        } catch (error) {
            // Keep the connection-based defaults if the probe fails.
        }

        return { minDurationMs, maxWaitMs };
    }

    function fadeOutLoader(loadingPage, durationMs) {
        const fadeSeconds = Math.max(durationMs / 1000, 0.35);
        loadingPage.style.animation = "fadeOut " + fadeSeconds + "s forwards";

        window.setTimeout(() => {
            loadingPage.style.display = "none";
            loadingPage.setAttribute("aria-hidden", "true");
        }, durationMs + 160);
    }

    window.initAdaptiveLoader = function initAdaptiveLoader(options) {
        const settings = options || {};
        const loadingPage = document.getElementById(settings.loaderId || "loadingPage");

        if (!loadingPage) {
            return;
        }

        const startedAt = performance.now();
        let finished = false;

        const finish = (minDurationMs) => {
            if (finished) {
                return;
            }

            finished = true;
            const elapsed = performance.now() - startedAt;
            const waitMs = Math.max((minDurationMs || 0) - elapsed, 0);

            window.setTimeout(() => {
                fadeOutLoader(loadingPage, 450);
            }, waitMs);
        };

        estimateLoaderTiming()
            .then((timing) => {
                const hardTimeout = window.setTimeout(() => finish(0), timing.maxWaitMs);

                pageLoaded()
                    .then(() => {
                        window.clearTimeout(hardTimeout);
                        finish(timing.minDurationMs);
                    })
                    .catch(() => {
                        window.clearTimeout(hardTimeout);
                        finish(0);
                    });
            })
            .catch(() => {
                pageLoaded().then(() => finish(700));
            });
    };
})();
