"""Доп. проверки: без WebGL, reduced motion, офлайн-экран PWA, кабинет на телефоне, тёмная тема кабинета.
Запуск: python3 tests/e2e/extra.py http://localhost:3000 <ADMIN_PASSWORD> <out_dir>"""
import asyncio, sys, os
from playwright.async_api import async_playwright
BASE, PW, OUT = sys.argv[1], sys.argv[2], sys.argv[3]; os.makedirs(OUT, exist_ok=True)
res = []
def check(n, ok, x=""): res.append(ok); print(("PASS " if ok else "FAIL ") + n + (f" — {x}" if x else ""), flush=True)
async def main():
    async with async_playwright() as p:
        # 1. Без WebGL
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--disable-webgl", "--disable-webgl2", "--disable-3d-apis"])
        pg = await (await b.new_context(viewport={"width": 390, "height": 844}, is_mobile=True)).new_page()
        await pg.goto(BASE + "/", wait_until="networkidle"); await pg.wait_for_timeout(1500)
        check("без WebGL показан постер и пояснение", await pg.locator(".stage-poster img").count() == 1 and "3D недоступно" in await pg.locator(".stage").inner_text())
        await pg.locator(".panel").get_by_role("button", name="Добавить в заявку").click()
        check("без WebGL заказ работает", "1" in await pg.locator(".site-header .badge").inner_text())
        await pg.screenshot(path=f"{OUT}/nowebgl.png"); await b.close()
        b = await p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"])
        # 2. Reduced motion + быстрые переключения категорий
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce", is_mobile=True, has_touch=True)
        pg = await ctx.new_page(); errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto(BASE + "/", wait_until="networkidle"); await pg.wait_for_timeout(2000)
        for c in ["Кресло", "Матрас", "Стул", "Другое", "Диван", "Матрас", "Кресло"]:
            await pg.get_by_role("button", name=c, exact=True).click(); await pg.wait_for_timeout(60)
        await pg.wait_for_timeout(1500)
        check("быстрые переключения без ошибок, загрузка завершилась", not errs and await pg.locator(".stage-center").count() == 0, "; ".join(errs)[:200])
        await pg.screenshot(path=f"{OUT}/reduced-motion-armchair.png")
        # 3. PWA офлайн-экран
        sw = await pg.evaluate("navigator.serviceWorker ? navigator.serviceWorker.ready.then(r => !!r.active) : false")
        check("сервис-воркер активен", sw)
        await ctx.set_offline(True)
        await pg.goto(BASE + "/services"); await pg.wait_for_timeout(800)
        check("без сети показан офлайн-экран", "Нет соединения" in await pg.locator("body").inner_text())
        await pg.screenshot(path=f"{OUT}/offline.png")
        await ctx.set_offline(False)
        man = await pg.request.get(BASE + "/manifest.webmanifest"); mj = await man.json()
        check("manifest: standalone и иконки", mj.get("display") == "standalone" and len(mj.get("icons", [])) >= 3)
        for path in ["/robots.txt", "/sitemap.xml"]:
            r = await pg.request.get(BASE + path); check(f"{path} отдаётся", r.status == 200)
        r = await pg.request.get(BASE + "/admin/login"); check("кабинет закрыт от индексации", "noindex" in (r.headers.get("x-robots-tag") or ""))
        # 4. Кабинет на телефоне, тёмная тема
        a = await (await b.new_context(viewport={"width": 390, "height": 844}, color_scheme="dark", is_mobile=True)).new_page()
        await a.goto(BASE + "/admin/login", wait_until="networkidle"); await a.fill("#pw", PW); await a.get_by_role("button", name="Войти").click(); await a.wait_for_url(BASE + "/admin"); await a.wait_for_timeout(1000)
        await a.screenshot(path=f"{OUT}/admin-mobile-dark.png", full_page=True)
        for path, name in [("/admin/prices", "prices"), ("/admin/game", "game"), ("/admin/characters", "characters"), ("/admin/company", "company"), ("/admin/access", "access")]:
            await a.goto(BASE + path, wait_until="networkidle"); await a.wait_for_timeout(300); await a.screenshot(path=f"{OUT}/admin-{name}.png", full_page=True)
        check("разделы кабинета открываются", True)
        await b.close()
    print(f"ИТОГО: {sum(res)}/{len(res)}"); sys.exit(0 if all(res) else 1)
asyncio.run(main())
