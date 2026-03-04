export class RenderViewportSystem {
    constructor(renderer, options = {}) {
        this.renderer = renderer;
        this.width = Number(options.width) || window.innerWidth;
        this.height = Number(options.height) || window.innerHeight;
        this.splitScreen = !!options.splitScreen;
        this.renderer.setSize(this.width, this.height);
    }

    getAspect() {
        if (this.splitScreen) {
            return (this.width / 2) / this.height;
        }
        return this.width / this.height;
    }

    updateCameraAspects(cameras) {
        const aspect = this.getAspect();
        for (const cam of cameras) {
            cam.aspect = aspect;
            cam.updateProjectionMatrix();
        }
    }

    setSplitScreen(enabled, cameras) {
        this.splitScreen = !!enabled;
        this.updateCameraAspects(cameras);
    }

    onResize(cameras) {
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.renderer.setSize(this.width, this.height);
        this.updateCameraAspects(cameras);
    }

    render(scene, cameras) {
        const w = this.width;
        const h = this.height;

        if (this.splitScreen && cameras.length >= 2) {
            this.renderer.setViewport(0, 0, w / 2, h);
            this.renderer.setScissor(0, 0, w / 2, h);
            this.renderer.setScissorTest(true);
            this.renderer.render(scene, cameras[0]);

            this.renderer.setViewport(w / 2, 0, w / 2, h);
            this.renderer.setScissor(w / 2, 0, w / 2, h);
            this.renderer.render(scene, cameras[1]);

            this.renderer.setScissorTest(false);
            return;
        }

        if (cameras.length > 0) {
            this.renderer.setViewport(0, 0, w, h);
            this.renderer.render(scene, cameras[0]);
        }
    }
}
