"""
Сквозная проверка: клиент собирает заказ → черновик переживает перезагрузку → фото →
сбой сети при отправке → повтор без дубля → страница заявки → владелец согласует → клиент видит.
Запуск: python3 tests/e2e/flow.py http://localhost:3000 <ADMIN_PASSWORD> <out_dir>
Все данные вымышленные.
"""
import asyncio, sys, os, io, json, re, datetime, subprocess

def db_count():
    url = os.environ.get("DATABASE_URL")
    if not url: return None
    return int(subprocess.check_output(["psql", url, "-tAc", "select count(*) from orders"]).strip())
from playwright.async_api import async_playwright
from PIL import Image

BASE, PW, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
os.makedirs(OUT, exist_ok=True)
CHROME = dict(executable_path="/usr/bin/google-chrome", args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
results = []

def check(name, ok, extra=""):
    results.append((name, bool(ok), extra))
    print(("PASS " if ok else "FAIL ") + name + (f" — {extra}" if extra else ""), flush=True)

def make_jpeg(path, color=(150, 110, 80)):
    Image.new("RGB", (800, 600), color).save(path, "JPEG")

async def main():
    jpg = os.path.join(OUT, "test-photo.jpg"); make_jpeg(jpg)
    fake = os.path.join(OUT, "fake.jpg"); open(fake, "w").write("это не картинка")
    async with async_playwright() as p:
        b = await p.chromium.launch(**CHROME)
        ctx = await b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
        page = await ctx.new_page()
        errors = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        await page.goto(BASE + "/", wait_until="networkidle")
        await page.wait_for_timeout(2500)

        # Матрас: двуспальный, вторая сторона, сильные загрязнения
        await page.get_by_role("button", name="Матрас", exact=True).click()
        await page.get_by_role("button", name=re.compile("^Двуспальный")).click()
        await page.get_by_role("switch", name="Чистить вторую сторону").check()
        await page.get_by_role("switch", name="Сильные загрязнения").check()
        price = await page.locator(".price-big").inner_text()
        # 10000 × 1.7 × 1.3 = 22100
        check("цена матраса в конфигураторе = 22 100", "22" in price and "100" in price, price)
        await page.wait_for_timeout(900)
        await page.screenshot(path=f"{OUT}/01-mattress.png")
        await page.locator(".panel").get_by_role("button", name="Добавить в заявку").click()

        # Тот же матрас ещё раз — должен объединиться (qty 2), а не задвоиться
        await page.locator(".panel").get_by_role("button", name="Добавить в заявку").click()

        # Стул: 4 шт по умолчанию
        await page.get_by_role("button", name="Стул", exact=True).click()
        await page.locator(".panel").get_by_role("button", name="Добавить в заявку").click()

        # Другое без описания → ошибка рядом с полем
        await page.get_by_role("button", name="Другое", exact=True).click()
        await page.locator(".panel").get_by_role("button", name="Добавить в заявку").click()
        check("«Другое» без описания показывает ошибку", await page.locator(".panel .err").count() == 1)
        await page.fill("#other-desc", "Пуф 60×60, велюр, пятно от кофе")
        check("«Другое» показывает «По фото», не 0", (await page.locator(".price-big").inner_text()).strip() == "По фото")
        await page.locator(".panel").get_by_role("button", name="Добавить в заявку").click()
        await page.wait_for_timeout(1200)
        await page.screenshot(path=f"{OUT}/02-other.png")

        # Корзина
        await page.locator(".site-header").get_by_role("button", name="Корзина", exact=False).click()
        await page.wait_for_timeout(500)
        lines = await page.locator(".sheet .cart-item").count()
        check("в корзине 3 строки (одинаковые матрасы объединены)", lines == 3, str(lines))
        await page.screenshot(path=f"{OUT}/03-cart.png")
        # Удаление с отменой
        await page.locator(".sheet .cart-item").nth(1).get_by_role("button", name="Удалить").click()
        await page.wait_for_timeout(300)
        after_del = await page.locator(".sheet .cart-item").count()
        await page.get_by_role("button", name="Вернуть").click()
        await page.wait_for_timeout(300)
        check("удаление и отмена удаления", after_del == 2 and await page.locator(".sheet .cart-item").count() == 3)
        total_text = await page.locator(".sheet .totals .row.total").inner_text()
        check("смешанный заказ: «+ по фото» в итоге", "по фото" in total_text, total_text.replace("\n", " "))
        await page.get_by_role("link", name="Оформить заявку").click()
        await page.wait_for_url("**/checkout")
        await page.wait_for_timeout(600)

        # Форма и черновик
        await page.fill("#f-name", "Тестовый Клиент")
        await page.fill("#f-phone", "+7 700 000 00 00")
        await page.fill("#f-time", "14:30")
        await page.get_by_role("button", name="Отправить заявку").click()
        await page.wait_for_timeout(300)
        errs = await page.locator(".err").all_inner_texts()
        check("ошибки у полей: адрес, дата для времени, фото, согласие", any("адрес" in e.lower() for e in errs) and any("дата" in e.lower() for e in errs) and any("фото" in e.lower() for e in errs) and any("соглас" in e.lower() for e in errs), "; ".join(errs))
        await page.screenshot(path=f"{OUT}/04-form-errors.png", full_page=True)
        await page.fill("#f-addr", "ул. Вымышленная, 5, кв. 12")
        VISIT = (datetime.date.today() + datetime.timedelta(days=10)).isoformat()
        await page.fill("#f-date", VISIT)
        await page.fill("#f-comment", "Домофон 12")
        await page.reload(wait_until="networkidle")
        await page.wait_for_timeout(800)
        check("черновик формы восстановлен после перезагрузки", await page.input_value("#f-addr") == "ул. Вымышленная, 5, кв. 12" and await page.input_value("#f-name") == "Тестовый Клиент")
        check("корзина восстановлена после перезагрузки", await page.locator(".cart-item").count() == 3)

        # Фото: поддельный файл отклоняется сервером, настоящий загружается
        async with page.expect_file_chooser() as fc:
            await page.get_by_role("button", name="+ Добавить фото").click()
        await (await fc.value).set_files(fake)
        await page.wait_for_timeout(1200)
        check("поддельный JPEG отклонён сервером, ошибка у поля", await page.locator(".err").filter(has_text="JPEG").count() >= 1)
        await page.get_by_role("button", name="Убрать фото").click()
        # серверная проверка сигнатуры: тот же мусор с типом image/jpeg
        r = await page.evaluate("""async () => { const fd = new FormData(); fd.append('file', new File(['not an image'], 'x.jpg', {type:'image/jpeg'})); const r = await fetch('/api/uploads', {method:'POST', body: fd}); return [r.status, (await r.json()).error]; }""")
        check("сервер проверяет реальный формат файла", r[0] == 422, str(r))
        # сбой сети при загрузке → повтор
        await page.route("**/api/uploads", lambda route: route.abort())
        async with page.expect_file_chooser() as fc:
            await page.get_by_role("button", name="+ Добавить фото").click()
        await (await fc.value).set_files(jpg)
        await page.wait_for_timeout(700)
        check("ошибка загрузки фото с кнопкой повтора", await page.get_by_role("button", name="Повторить").count() == 1)
        await page.unroute("**/api/uploads")
        await page.get_by_role("button", name="Повторить").click()
        await page.wait_for_timeout(1500)
        check("фото загружено после повтора", await page.locator(".photo .ph-state", has_text="Загружено").count() == 1)
        await page.check("[data-field=consent]")
        await page.screenshot(path=f"{OUT}/05-form-filled.png", full_page=True)

        # Сбой сети при отправке: запрос доходит до сервера, но ответ теряется
        state = {"n": 0}
        async def flaky(route):
            state["n"] += 1
            if state["n"] == 1:
                resp = await route.fetch()  # сервер записал заявку
                await route.abort()          # а клиент ответа не получил
            else:
                await route.continue_()
        before = db_count()
        await page.route("**/api/orders", flaky)
        await page.get_by_role("button", name="Отправить заявку").click()
        await page.wait_for_timeout(1500)
        alert = await page.locator("#form-error").inner_text() if await page.locator("#form-error").count() else ""
        check("при сбое сети показана ошибка, форма сохранена", "Нет связи" in alert and await page.input_value("#f-name") == "Тестовый Клиент", alert)
        await page.get_by_role("button", name="Отправить заявку").click()
        try:
            await page.wait_for_url("**/o/**", timeout=10000)
        except Exception:
            print("DEBUG form-error:", await page.locator("#form-error").all_inner_texts(), state)
            raise
        await page.wait_for_timeout(1500)
        url = page.url
        token = url.split("/o/")[1].split("?")[0]
        after = db_count()
        if before is not None: check("сбой + повтор создали ровно одну запись в БД", after - before == 1, f"{before}→{after}")
        check("после повтора открыта приватная страница заявки", len(token) >= 24, url)
        await page.screenshot(path=f"{OUT}/06-order-page.png", full_page=True)
        body = await page.locator("main").inner_text()
        check("страница заявки: состав и предварительный расчёт", "Матрас" in body and "по фото" in body)
        check("пожелание по дате показано корректно", "Invalid" not in body)

        # Публичный API не отдаёт заметку и фото
        pub = await page.evaluate(f"fetch('/api/orders/{token}').then(r=>r.json())")
        check("публичный API без приватной заметки, фото и телефона", "owner_note" not in json.dumps(pub) and "photos" not in pub and "phone" not in pub, ",".join(pub.keys()))
        check("цены сохранены снимком: матрас 22 100 × 2", any(l.get("lineTotal") == 44200 for l in pub["items"]), str([l.get("lineTotal") for l in pub["items"]]))
        check("корзина очищена после отправки", await page.evaluate("JSON.parse(localStorage.getItem('vors.cart.v1')||'[]').length") == 0)

        # Владелец
        actx = await b.new_context(viewport={"width": 1280, "height": 900})
        a = await actx.new_page()
        await a.goto(BASE + "/admin", wait_until="networkidle")
        check("кабинет без входа перенаправляет на логин", "/admin/login" in a.url)
        await a.fill("#pw", "неверный-пароль")
        await a.get_by_role("button", name="Войти").click()
        await a.wait_for_timeout(800)
        check("неверный пароль отклонён", await a.locator("#pw-err").count() == 1)
        await a.fill("#pw", PW)
        await a.get_by_role("button", name="Войти").click()
        await a.wait_for_url(BASE + "/admin")
        await a.wait_for_timeout(800)
        await a.screenshot(path=f"{OUT}/07-admin-list.png", full_page=True)
        rows = await a.locator(".orders-table tbody tr").all_inner_texts()
        num = pub["number"]
        mine = [r for r in rows if f"№ {num}" in r]
        check("новая заявка видна в кабинете", len(mine) == 1, str(len(mine)))
        await a.fill("input[type=search]", "700 000 00 00")
        await a.wait_for_timeout(900)
        check("поиск по телефону", await a.locator(".orders-table tbody tr").count() >= 1)
        await a.locator(".orders-table tbody tr").first.get_by_role("link").first.click()
        await a.wait_for_url("**/admin/orders/**")
        await a.wait_for_timeout(800)
        check("фото доступно в кабинете", await a.locator(".admin-photos img").count() == 1)
        photo_src = await a.locator(".admin-photos img").first.get_attribute("src")
        await a.select_option("#st", "agreed")
        await a.get_by_role("button", name="Сохранить").click()
        await a.wait_for_timeout(800)
        check("статус «согласовано» без цены и времени не сохраняется", await a.locator(".alert").count() == 1)
        await a.fill("#fp", "26500")
        await a.fill("#vt", VISIT + "T14:30")
        await a.fill("#nt", "Секретная заметка владельца")
        await a.get_by_role("button", name="Сохранить").click()
        await a.wait_for_timeout(1000)
        check("согласование сохранено", await a.locator(".saved").count() >= 1)
        await a.screenshot(path=f"{OUT}/08-admin-order.png", full_page=True)

        # Клиент видит обновление по той же ссылке
        await page.reload(wait_until="networkidle")
        await page.wait_for_timeout(800)
        body = (await page.locator("main").inner_text()).replace("\u00a0", " ").replace("\u202f", " ")
        check("клиент видит цену и время после согласования", "26 500" in body and "Согласована" in body)
        check("клиент не видит приватную заметку", "Секретная" not in body)
        await page.screenshot(path=f"{OUT}/09-order-agreed.png", full_page=True)

        # Закрытые маршруты для анонима
        anon = await b.new_context()
        ap = await anon.new_page()
        r1 = await ap.request.get(BASE + "/api/admin/orders")
        r2 = await ap.request.get(BASE + photo_src)
        r3 = await ap.request.post(BASE + "/api/orders", data="{}", headers={"origin": "https://evil.example", "content-type": "application/json"})
        r4 = await ap.request.get(BASE + "/o/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA")
        check("admin API без сессии: 401", r1.status == 401, str(r1.status))
        check("фото без сессии: 401", r2.status == 401, str(r2.status))
        check("чужой Origin: 403", r3.status == 403, str(r3.status))
        check("случайный токен заявки: 404", r4.status == 404, str(r4.status))

        # Темы и игра
        await page.emulate_media(color_scheme="dark")
        await page.evaluate("localStorage.setItem('vors.theme','dark')")
        await page.reload(wait_until="networkidle")
        await page.wait_for_timeout(600)
        check("тёмная тема применяется", await page.evaluate("document.documentElement.dataset.theme") == "dark")
        btn = page.get_by_role("button", name="Почистить пятна")
        if await btn.count():
            await btn.click()
            await page.wait_for_timeout(3500)
            box = await page.locator(".game-stage canvas").bounding_box()
            # проводим «пальцем» зигзагом по центру модели
            await page.mouse.move(box["x"] + box["width"] * 0.25, box["y"] + box["height"] * 0.45)
            await page.mouse.down()
            for i in range(60):
                x = box["x"] + box["width"] * (0.22 + 0.56 * ((i % 12) / 11))
                y = box["y"] + box["height"] * (0.35 + 0.3 * (i // 12) / 5)
                await page.mouse.move(x, y, steps=3)
            await page.mouse.up()
            await page.wait_for_timeout(500)
            pct = await page.locator(".game .num").inner_text()
            check("игра: стирание пятен меняет прогресс", pct.strip() != "0%", pct)
            await page.screenshot(path=f"{OUT}/10-game-dark.png", full_page=True)
        check("нет ошибок JS на клиенте", not errors, "; ".join(errors)[:300])
        await b.close()
    failed = [r for r in results if not r[1]]
    print(f"\nИТОГО: {len(results) - len(failed)}/{len(results)} проверок пройдено")
    sys.exit(1 if failed else 0)

asyncio.run(main())
