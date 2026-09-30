# Bezpieczna integracja z WordPressem

## Zmienne środowiskowe Vercel

```env
NEXT_PUBLIC_WORDPRESS_ORIGINS=https://konfigurator.staleuro.pl
WP_ALLOWED_ORIGINS=https://konfigurator.staleuro.pl
WP_URL=https://konfigurator.staleuro.pl
WP_ADMIN_URL=https://konfigurator.staleuro.pl/wp-admin/admin.php?page=garage-orders
```

Lista może zawierać kilka adresów rozdzielonych przecinkami. W produkcji nie należy
dodawać symboli wieloznacznych ani protokołu HTTP.

## Uruchamianie panelu ofertowego

Panel korzysta z normalnego widoku konfiguratora. Do adresu iframe otwieranego z
uwierzytelnionego panelu zamówień należy dodać:

```text
offer_mode=1
```

Przykład:

```text
https://ADRES-VERCEL/?load_config=...&store_url=https%3A%2F%2Fkonfigurator.staleuro.pl&offer_mode=1
```

W tym trybie przycisk zakupu zostaje zastąpiony przyciskiem „Przygotuj ofertę”.
Dane klienta wprowadzone w oknie oferty są używane lokalnie do wygenerowania PDF
i nie są wysyłane do Vercel.

## Odbieranie danych z iframe

Kod WordPress musi sprawdzać jednocześnie `event.origin` i `event.source`:

```js
const configuratorOrigin = 'https://ADRES-VERCEL';

window.addEventListener('message', (event) => {
  if (event.origin !== configuratorOrigin) return;
  if (event.source !== configuratorIframe.contentWindow) return;
  if (event.data?.action !== 'konfigurator_checkout') return;
  if (event.data?.version !== 2) return;

  // Do serwera wysyłamy konfigurację, nonce i opcjonalną miniaturę.
  // NIE wysyłamy ceny jako wartości wiążącej.
});
```

Po stronie Next.js wiadomość nie jest już wysyłana do `'*'`, lecz do dokładnego
originu wynikającego z `store_url` i listy `NEXT_PUBLIC_WORDPRESS_ORIGINS`.

## Zasady endpointu koszyka

Endpoint WordPress/WooCommerce przed modyfikacją koszyka musi:

1. Przyjmować tylko `POST`.
2. Sprawdzić nonce wygenerowany przez WordPress.
3. Ograniczyć wielkość żądania oraz długość miniatury.
4. Zdekodować konfigurację do tablicy i odrzucić nieznane pola.
5. Sprawdzić typy, zakresy wymiarów, liczbę elementów i dozwolone identyfikatory.
6. Ponownie policzyć cenę na podstawie opcji zapisanych na serwerze.
7. Zignorować pola `price` i `estimatedPrice` przy ustalaniu ceny WooCommerce.
8. Dodać do koszyka skrót zatwierdzonej konfiguracji i wersję cennika.
9. Stosować rate limiting dla niezalogowanych użytkowników.
10. Zapisywać w logu rozbieżność pomiędzy ceną orientacyjną a serwerową.

Pole `price` jest jeszcze wysyłane przez Next.js wyłącznie dla zgodności ze starą
wersją wtyczki. Nie może być użyte jako cena produktu.

## Zasady ofert

- Dostęp do konfiguracji klienta powinien wymagać uprawnienia `manage_woocommerce`.
- Formularz „Przygotuj ofertę” powinien być otwierany tylko z panelu zamówień.
- Cena w finalnej, wiążącej ofercie musi pochodzić z tej samej serwerowej funkcji
  wyceny, która obsługuje koszyk.
- Adres modelu AR w QR musi być trwały. Adresy `blob:` działają tylko w jednej karcie
  przeglądarki i nie nadają się do PDF.
- Dane klienta powinny być przechowywane wyłącznie w WordPressie/WooCommerce albo
  innym zatwierdzonym magazynie, nie w `localStorage`.

