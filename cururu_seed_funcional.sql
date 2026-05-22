--
-- PostgreSQL database dump
--

\restrict 6wjVZ6uh1X7ssF19TtIf3oAMABOA1R8XYfxsGdu94W1PnPEWJFxUQHwbDKKAe7p

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: actividades; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.actividades (id, titulo, descripcion, fecha, hora, ubicacion, imagen_url, cupo_maximo, cupos_disponibles, activo, created_at, tipo, updated_at) VALUES ('3f6789ff-a668-4518-bd5c-1efad364981c', 'Prueba entrega junio nacho 1', 'Primera entrega de junio 26 prueba 1 ', '2026-06-04', '18:00:00', 'Usted sape', NULL, NULL, NULL, true, '2026-05-14 10:33:02.542482', 'actividad', '2026-05-16 01:16:03.271672+00');


--
-- Data for Name: configuracion_sistema; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.configuracion_sistema (id, clave, valor, created_at, updated_at) VALUES (1, 'horas_limite_primer', '48', '2026-03-30 23:41:38.24898+00', '2026-03-30 23:41:38.24898+00');
INSERT INTO public.configuracion_sistema (id, clave, valor, created_at, updated_at) VALUES (2, 'horas_limite_ultimo', '72', '2026-03-30 23:41:38.24898+00', '2026-03-30 23:41:38.24898+00');
INSERT INTO public.configuracion_sistema (id, clave, valor, created_at, updated_at) VALUES (3, 'historia_texto', 'Cururu Club Cannabico

Flores de alta calidad y una experiencia cuidada para quienes buscan elegir y consumir de forma consciente.

Ofrecemos más de 6 variedades durante todo el año, cultivadas con estrategias biominerales en exterior e invernáculo con luz asistida, logrando consistencia en cada cosecha.

¿Qué ofrecemos?
	•	Calidad superior con variedades a elección
	•	Mismo estándar todo el año
	•	Precios según tipo de cultivo (exterior o invernáculo)

Condiciones:
	•	Mínimo: 20 g por variedad / mes
	•	Máximo: 40 g por variedad / mes (combinables entre variedades en packs de a 20 gramos)

Si te interesa, coordinamos una reunión y te contamos cómo trabajamos.

Cururú Club Cannábico — calidad y transparencia.', '2026-03-30 23:41:38.24898+00', '2026-03-30 23:41:38.24898+00');
INSERT INTO public.configuracion_sistema (id, clave, valor, created_at, updated_at) VALUES (4, 'cifra_socios', '35', '2026-03-30 23:41:38.24898+00', '2026-03-30 23:41:38.24898+00');
INSERT INTO public.configuracion_sistema (id, clave, valor, created_at, updated_at) VALUES (5, 'cifra_cepas', '12', '2026-03-30 23:41:38.24898+00', '2026-03-30 23:41:38.24898+00');
INSERT INTO public.configuracion_sistema (id, clave, valor, created_at, updated_at) VALUES (6, 'cifra_anios', '9', '2026-03-30 23:41:38.24898+00', '2026-03-30 23:41:38.24898+00');
INSERT INTO public.configuracion_sistema (id, clave, valor, created_at, updated_at) VALUES (97, 'historia_video_url', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/noticias/historia_video_1776899904368_g07gbj3gkwn.mp4', '2026-04-22 16:45:21.578715+00', '2026-04-22 16:45:21.578715+00');
INSERT INTO public.configuracion_sistema (id, clave, valor, created_at, updated_at) VALUES (98, 'historia_galeria', '[]', '2026-04-22 16:45:21.916408+00', '2026-04-22 16:45:21.916408+00');


--
-- Data for Name: noticias; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.noticias (id, titulo, contenido, imagen_url, autor, fecha_publicacion, destacado, activo, created_at, updated_at) VALUES ('20b899d0-2cf3-4bf0-8891-70a235bc4873', 'Variedades que se plantaron en 2026', 'Exterior:
- Funky Charm del banco Exotic Genetics
- Gellato banco desconocido
- Red Pop del banco Exotic Genetics
- Tangie del banco DNA Genetics
- Suguz del banco Rkiem Genetics

Invernaculo:
- Suguz 
- Red Pop
- 24 kilates 
- Lemon Drip
- Gorilla Glue
- Temptation
- Tangie
- Funky Charm
', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/noticias/noticia_1776877173714_ttcrkis4t6.jpeg', 'Cururú Club ', '2026-04-22 16:59:35.580797', false, true, '2026-04-22 16:59:35.580797', '2026-05-16 01:16:03.271672+00');


--
-- Data for Name: productos; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.productos (id, nombre, descripcion, imagen_url, cepa, thc_porcentaje, cbd_porcentaje, fecha_cosecha, lote_id, disponible, created_at, activo, precio_por_10g, tipo_cultivo, indica_sativa, updated_at) VALUES ('e416bf9c-4f5c-46a5-8f7d-29f4afc82b4f', '24 K Gold ', 'Una genética que hace honor a su nombre: 24K Gold es un híbrido de lujo que combina lo mejor de Kosher Kush x Tangie, dando como resultado una experiencia tan brillante como potente.  ￼

De entrada, deslumbra con un perfil aromático intenso a mandarina dulce y cítricos, envuelto en notas kush profundas y terrosas. En boca, es pura fruta con carácter, ideal para quienes buscan sabores marcados y memorables.  ￼

Su efecto es equilibrado y envolvente: comienza con una subida eufórica y creativa, elevando el ánimo, para luego transformarse en una relajación corporal cálida y duradera. Perfecta para desconectar sin quedar fuera de juego.  ￼

👉 En resumen: una variedad premium, resinosa y sabrosa, pensada para quienes quieren potencia, sabor y equilibrio en un solo golpe dorado.', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_edit_1776968180187_wkbk54pvr5.jpeg', '60% Indica - 40% Sativa', 24.00, NULL, NULL, NULL, true, '2026-04-23 11:44:48.005387', true, 2000.00, 'invernaculo', '60% Indica - 40% Sativa', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos (id, nombre, descripcion, imagen_url, cepa, thc_porcentaje, cbd_porcentaje, fecha_cosecha, lote_id, disponible, created_at, activo, precio_por_10g, tipo_cultivo, indica_sativa, updated_at) VALUES ('4d33b507-fdd1-449d-bb9a-47fc94d7b517', 'Red Pop', 'Una genética que destaca por su identidad única: Red Pop es un híbrido moderno creado por Exotic Genetix a partir del cruce Strawberry x Cookies & Cream, pensado para quienes buscan sabor intenso y perfil “candy” fuera de lo común.  ￼

A nivel aromático es donde realmente brilla: ofrece un perfil que recuerda a un refresco de cola con notas de fresa cremosa, dulce, gaseoso y muy marcado, algo que la convirtió en base de muchas otras genéticas del banco.  ￼

El efecto es equilibrado pero con tendencia relajante: comienza con una sensación alegre y estimulante, y evoluciona hacia una relajación corporal más profunda, ideal para disfrutar sin prisa.

👉 En resumen: una genética “de autor”, con un perfil terpénico distintivo tipo soda dulce + fruta, muy buscada por amantes de sabores intensos.', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_edit_1776967359956_24vb8r8cw0f.jpeg', '60% Indica - 40% Sativa', 28.00, NULL, NULL, NULL, true, '2026-04-23 11:40:42.883321', true, 2000.00, 'invernaculo', '60% Indica - 40% Sativa', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos (id, nombre, descripcion, imagen_url, cepa, thc_porcentaje, cbd_porcentaje, fecha_cosecha, lote_id, disponible, created_at, activo, precio_por_10g, tipo_cultivo, indica_sativa, updated_at) VALUES ('561f2d87-0198-43ed-9976-a9639829a5a5', 'Gellato', 'Una de las genéticas más influyentes de la era moderna: Gelato es un híbrido premium nacido del cruce Sunset Sherbet x Thin Mint GSC (Girl Scout Cookies), famoso por su perfil dulce, cremoso y afrutado tipo postre que marcó tendencia en toda la industria.

A nivel sensorial, es una bomba “dessert”: mezcla helado cremoso, frutas dulces, vainilla y un fondo terroso/cookies, con una densidad terpénica que la hizo base de innumerables cruces actuales.

El efecto es equilibrado pero potente: empieza con una euforia mental clara y placentera, y evoluciona hacia una relajación corporal cálida, sin llegar a ser completamente sedante. Es versátil: sirve tanto para disfrutar activo como para bajar revoluciones.

👉 En resumen: una genética icónica, base de gran parte del mercado actual, ideal para quienes buscan sabor tipo postre + potencia equilibrada.', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776944976046_kzzttvgixo.jpeg', '60% Indica - 40% Sativa', 25.00, NULL, NULL, NULL, true, '2026-04-23 11:49:39.638671', true, 1500.00, 'exterior', '60% Indica - 40% Sativa', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos (id, nombre, descripcion, imagen_url, cepa, thc_porcentaje, cbd_porcentaje, fecha_cosecha, lote_id, disponible, created_at, activo, precio_por_10g, tipo_cultivo, indica_sativa, updated_at) VALUES ('1046d072-c450-48e2-89e3-274311d74c2d', 'Funky Charm', 'Una genética que hace honor a su nombre: Funky Charms es un híbrido moderno y potente creado a partir del cruce Rainbow Chip x Grease Monkey, diseñado para quienes buscan resina extrema, terpenos complejos y un perfil “funky” inconfundible.  ￼

A nivel aromático, es una bomba: mezcla frutas exóticas y frutos rojos con un fondo dulce, terroso y cremoso, acompañado de notas tipo chocolate-menta y gasolina suave. Un perfil denso y muy “americano”, ideal para extracciones y amantes de sabores intensos.  ￼

El efecto es potente y progresivo: arranca con una euforia marcada que levanta el ánimo, pero rápidamente se transforma en una relajación profunda, casi sedante, típica de las índicas modernas de alto THC.  ￼

👉 En resumen: una genética resinosa y contundente, pensada para quienes buscan sabor complejo + pegada fuerte en formato premium.', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776968397095_adjzj0s9en4.jpeg', '60% Indica - 40% Sativa', 26.00, NULL, NULL, NULL, true, '2026-04-23 18:20:23.680475', true, 2000.00, 'invernaculo', '60% Indica - 40% Sativa', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos (id, nombre, descripcion, imagen_url, cepa, thc_porcentaje, cbd_porcentaje, fecha_cosecha, lote_id, disponible, created_at, activo, precio_por_10g, tipo_cultivo, indica_sativa, updated_at) VALUES ('346571c4-3798-4fce-b902-29fbea9ef8ed', 'Gellato', 'Una de las genéticas más influyentes de la era moderna: Gelato es un híbrido premium nacido del cruce Sunset Sherbet x Thin Mint GSC (Girl Scout Cookies), famoso por su perfil dulce, cremoso y afrutado tipo postre que marcó tendencia en toda la industria.

A nivel sensorial, es una bomba “dessert”: mezcla helado cremoso, frutas dulces, vainilla y un fondo terroso/cookies, con una densidad terpénica que la hizo base de innumerables cruces actuales.

El efecto es equilibrado pero potente: empieza con una euforia mental clara y placentera, y evoluciona hacia una relajación corporal cálida, sin llegar a ser completamente sedante. Es versátil: sirve tanto para disfrutar activo como para bajar revoluciones.

👉 En resumen: una genética icónica, base de gran parte del mercado actual, ideal para quienes buscan sabor tipo postre + potencia equilibrada.', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776969607683_wgytpx1pdu.jpeg', '55% Indica - 45% Sativa', 25.00, NULL, NULL, NULL, true, '2026-04-23 18:40:16.750046', true, 2000.00, 'invernaculo', NULL, '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos (id, nombre, descripcion, imagen_url, cepa, thc_porcentaje, cbd_porcentaje, fecha_cosecha, lote_id, disponible, created_at, activo, precio_por_10g, tipo_cultivo, indica_sativa, updated_at) VALUES ('bd39ea0e-04b3-453d-8b03-97376cee46e2', 'Temptation', 'Una genética que entra directo en la categoría “premium dulce”: Temptation es un híbrido moderno asociado a la línea Cookies, generalmente resultado del cruce Ice Cream Cake x Jealousy, pensada para quienes buscan perfil cremoso, potente y ultra resinoso.

En lo sensorial, es puro postre: combina vainilla, crema, galleta dulce y toques frutales, con un fondo ligeramente terroso y “gassy”. Es de esas variedades densas, pesadas en aroma, ideales para flores top shelf o extracciones.

El efecto es potente y envolvente: comienza con una subida mental placentera y relajada, sin demasiada aceleración, y evoluciona hacia una relajación corporal profunda, pudiendo volverse algo sedante en dosis altas.

👉 En resumen: una genética moderna de perfil “dessert”, perfecta para quienes buscan sabor dulce intenso + efecto relajante premium.', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776968623228_sx8my5f32mc.jpeg', '60% Indica - 40% Sativa', 27.00, NULL, NULL, NULL, true, '2026-04-23 18:23:53.529648', true, 2000.00, 'invernaculo', '60% Indica - 40% Sativa', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos (id, nombre, descripcion, imagen_url, cepa, thc_porcentaje, cbd_porcentaje, fecha_cosecha, lote_id, disponible, created_at, activo, precio_por_10g, tipo_cultivo, indica_sativa, updated_at) VALUES ('4d5cef31-59f8-4c3d-8ada-1cbb1d3793fc', 'Tropicana Banana #2', 'Una genética que entra directo en el segmento “tropical premium”: Tropicana Banana es un híbrido moderno creado a partir del cruce Tropicanna (GSC x Tangie) x Banana Kush, combinando lo mejor de los perfiles cítricos con un fondo dulce y cremoso tipo banana.  ￼

En lo sensorial, es una verdadera bomba exótica: mezcla frutas tropicales, cítricos tipo naranja/mandarina y banana dulce, con un fondo ligeramente cremoso y terroso. Es un perfil muy atractivo para quienes buscan algo fresco pero con cuerpo.  ￼

El efecto es activo pero equilibrado: comienza con una euforia energética, creativa y motivadora, y luego aparece una relajación suave heredada de Banana Kush, sin llegar a ser pesada. Ideal para uso diurno o social.  ￼

👉 En resumen: una genética moderna, productiva y muy sabrosa, perfecta para quienes buscan cítrico tropical + dulzor + efecto funcional y positivo.', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776968844580_2j3i66obrs8.jpeg', '40% Indica - 60% Sativa', 25.00, NULL, NULL, NULL, true, '2026-04-23 18:27:33.357076', true, 2000.00, 'invernaculo', '40% Indica - 60% Sativa', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos (id, nombre, descripcion, imagen_url, cepa, thc_porcentaje, cbd_porcentaje, fecha_cosecha, lote_id, disponible, created_at, activo, precio_por_10g, tipo_cultivo, indica_sativa, updated_at) VALUES ('899ec776-471b-41d7-9c99-41064b2f2901', 'Tangie', 'Una genética icónica que marcó una época: Tangie es un híbrido legendario creado por DNA Genetics a partir de California Orange x Skunk #1, famoso por su perfil cítrico explosivo tipo mandarina que redefinió el estándar de sabor en la escena cannábica.  ￼

A nivel aromático, es pura intensidad: naranja dulce, mandarina y cítricos frescos, con un fondo ligeramente skunk. Es una de esas variedades donde el olor ya anticipa exactamente lo que vas a probar.  ￼

El efecto es claramente estimulante y cerebral: genera una subida eufórica, energética y creativa, ideal para el día o actividades sociales. Es de las típicas sativas que levantan el ánimo y activan la cabeza.  ￼

👉 En resumen: una genética clásica y muy influyente, perfecta para quienes buscan sabor cítrico extremo + efecto activo y positivo.', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776969039730_wh60w6ktae.jpeg', '20% Indica - 80% Sativa', 22.00, NULL, NULL, NULL, true, '2026-04-23 18:30:49.882713', true, 2000.00, 'invernaculo', '20% Indica - 80% Sativa', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos (id, nombre, descripcion, imagen_url, cepa, thc_porcentaje, cbd_porcentaje, fecha_cosecha, lote_id, disponible, created_at, activo, precio_por_10g, tipo_cultivo, indica_sativa, updated_at) VALUES ('6eb76ea1-5b01-4a84-86dc-106a03e19344', 'Suguz', 'Una genética moderna que apunta directo al paladar: Suguz es un híbrido equilibrado nacido del cruce Platinum Zog x Ice Cream Cake, diseñado para quienes buscan resina, sabor y potencia en formato gourmet.  ￼

A nivel sensorial, destaca por un perfil afr utado y cremoso, con notas dulces tipo postre que se quedan en boca y en el ambiente. Es de esas variedades que no pasan desapercibidas: intensa, aromática y muy rica en terpenos.  ￼

El efecto es equilibrado y agradable: combina una subida mental suave que mejora el ánimo con una relajación corporal progresiva, ideal tanto para desconectar como para disfrutar tranquilo sin quedar totalmente apagado.  ￼

👉 En resumen: una genética versátil, resinosa y sabrosa, perfecta para quienes buscan equilibrio entre sabor premium y efecto completo.', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776969374287_a81tzjskedi.jpeg', '50% Indica - 50% Sativa', 25.00, NULL, NULL, NULL, true, '2026-04-23 18:36:26.408058', true, 2000.00, 'invernaculo', '50% Indica - 50% Sativa', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos (id, nombre, descripcion, imagen_url, cepa, thc_porcentaje, cbd_porcentaje, fecha_cosecha, lote_id, disponible, created_at, activo, precio_por_10g, tipo_cultivo, indica_sativa, updated_at) VALUES ('e3157122-27fb-497c-9041-e5ce4f093617', 'Gorilla Glue', 'Una genética legendaria que se volvió estándar global: Gorilla Glue #4 (GG4) es un híbrido ultra potente nacido del cruce Chem’s Sister x Sour Dubb x Chocolate Diesel, famosa por su producción extrema de resina y efecto demoledor.  ￼

En lo sensorial, es intensa y “pesada”: combina notas diesel, tierra, pino y chocolate, con un perfil profundo y penetrante. No es una cepa sutil — es de las que llenan el ambiente apenas abrís el frasco.  ￼

El efecto es lo que la hizo famosa: arranca con euforia fuerte y mental, pero rápidamente se transforma en una relajación corporal muy potente tipo “couch-lock”, ideal para desconectar o uso nocturno.  ￼

👉 En resumen: una genética icónica, extremadamente resinosa y potente, pensada para quienes buscan pegada fuerte + perfil clásico “gassy”.', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776969851183_tlkzdpzefun.jpeg', '60% Indica - 40% Sativa', 30.00, NULL, NULL, NULL, true, '2026-04-23 18:44:23.254328', true, 2000.00, 'invernaculo', NULL, '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos (id, nombre, descripcion, imagen_url, cepa, thc_porcentaje, cbd_porcentaje, fecha_cosecha, lote_id, disponible, created_at, activo, precio_por_10g, tipo_cultivo, indica_sativa, updated_at) VALUES ('1b72b9b0-4f64-45c6-9ad2-df219bc0632d', 'Suguz ', 'Una genética moderna que apunta directo al paladar: Suguz es un híbrido equilibrado nacido del cruce Platinum Zog x Ice Cream Cake, diseñado para quienes buscan resina, sabor y potencia en formato gourmet.  ￼

A nivel sensorial, destaca por un perfil afr utado y cremoso, con notas dulces tipo postre que se quedan en boca y en el ambiente. Es de esas variedades que no pasan desapercibidas: intensa, aromática y muy rica en terpenos.  ￼

El efecto es equilibrado y agradable: combina una subida mental suave que mejora el ánimo con una relajación corporal progresiva, ideal tanto para desconectar como para disfrutar tranquilo sin quedar totalmente apagado.  ￼

👉 En resumen: una genética versátil, resinosa y sabrosa, perfecta para quienes buscan equilibrio entre sabor premium y efecto completo.', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_edit_1776967913127_4utajawe4k.jpeg', '50% Indica - 50% Sativa', 25.00, NULL, NULL, NULL, true, '2026-04-22 17:04:16.835847', true, 1500.00, 'exterior', '50% Indica - 50% Sativa', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos (id, nombre, descripcion, imagen_url, cepa, thc_porcentaje, cbd_porcentaje, fecha_cosecha, lote_id, disponible, created_at, activo, precio_por_10g, tipo_cultivo, indica_sativa, updated_at) VALUES ('79ad8a0c-6747-49db-a582-b37858630669', 'Lemon Drip', 'Una genética moderna que combina potencia y frescura: Lemon Drip es un híbrido creado por Exotic Genetix a partir del cruce Lemon Tree x Grease Monkey, pensado para quienes buscan perfil cítrico intenso con un fondo cremoso y “gassy”.  ￼

En lo sensorial, es una bomba de terpenos: predominan los limones ácidos y dulces tipo limonada, acompañados de notas vainilla cremosa, galleta y un toque fuel. Es una combinación muy “americana”, fresca pero pesada a la vez.  ￼

El efecto es potente y versátil: arranca con una subida cerebral, creativa y energética, y luego evoluciona hacia una relajación física suave, sin volverte completamente sedentario.  ￼

👉 En resumen: una genética muy completa, ideal para quienes buscan cítrico premium + potencia + equilibrio moderno.', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776965751720_42sd2t60xjg.jpeg', '60% Indica - 40% Sativa', 23.00, NULL, NULL, NULL, true, '2026-04-23 17:36:07.008509', true, 2000.00, 'invernaculo', '60% Indica - 40% Sativa', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos (id, nombre, descripcion, imagen_url, cepa, thc_porcentaje, cbd_porcentaje, fecha_cosecha, lote_id, disponible, created_at, activo, precio_por_10g, tipo_cultivo, indica_sativa, updated_at) VALUES ('e66b4d8d-fb56-4b23-b04e-eaba689d5c80', 'Tangie', 'Una genética icónica que marcó una época: Tangie es un híbrido legendario creado por DNA Genetics a partir de California Orange x Skunk #1, famoso por su perfil cítrico explosivo tipo mandarina que redefinió el estándar de sabor en la escena cannábica.  ￼

A nivel aromático, es pura intensidad: naranja dulce, mandarina y cítricos frescos, con un fondo ligeramente skunk. Es una de esas variedades donde el olor ya anticipa exactamente lo que vas a probar.  ￼

El efecto es claramente estimulante y cerebral: genera una subida eufórica, energética y creativa, ideal para el día o actividades sociales. Es de las típicas sativas que levantan el ánimo y activan la cabeza.  ￼

👉 En resumen: una genética clásica y muy influyente, perfecta para quienes buscan sabor cítrico extremo + efecto activo y positivo.', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776970805496_l4uhhxcioxj.jpeg', '20% Indica - 80% Sativa', 20.00, NULL, NULL, NULL, true, '2026-04-23 19:00:38.033609', true, 1500.00, 'exterior', NULL, '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos (id, nombre, descripcion, imagen_url, cepa, thc_porcentaje, cbd_porcentaje, fecha_cosecha, lote_id, disponible, created_at, activo, precio_por_10g, tipo_cultivo, indica_sativa, updated_at) VALUES ('73b93602-226c-47a0-a3ef-7ae2f4e12329', 'Red Pop', 'Una genética que destaca por su identidad única: Red Pop es un híbrido moderno creado por Exotic Genetix a partir del cruce Strawberry x Cookies & Cream, pensado para quienes buscan sabor intenso y perfil “candy” fuera de lo común.  ￼

A nivel aromático es donde realmente brilla: ofrece un perfil que recuerda a un refresco de cola con notas de fresa cremosa, dulce, gaseoso y muy marcado, algo que la convirtió en base de muchas otras genéticas del banco.  ￼

El efecto es equilibrado pero con tendencia relajante: comienza con una sensación alegre y estimulante, y evoluciona hacia una relajación corporal más profunda, ideal para disfrutar sin prisa.

👉 En resumen: una genética “de autor”, con un perfil terpénico distintivo tipo soda dulce + fruta, muy buscada por amantes de sabores intensos.', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776970547558_7hibl4pnxy4.jpeg', '60% Indica - 40% Sativa', 24.00, NULL, NULL, NULL, true, '2026-04-23 18:56:09.212416', true, 1500.00, 'exterior', '60% Indica - 40% Sativa', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos (id, nombre, descripcion, imagen_url, cepa, thc_porcentaje, cbd_porcentaje, fecha_cosecha, lote_id, disponible, created_at, activo, precio_por_10g, tipo_cultivo, indica_sativa, updated_at) VALUES ('7e76174e-bf8e-41c0-b4e9-880b860c228f', 'Funky Charm', 'Una genética que hace honor a su nombre: Funky Charms es un híbrido moderno y potente creado a partir del cruce Rainbow Chip x Grease Monkey, diseñado para quienes buscan resina extrema, terpenos complejos y un perfil “funky” inconfundible.  ￼

A nivel aromático, es una bomba: mezcla frutas exóticas y frutos rojos con un fondo dulce, terroso y cremoso, acompañado de notas tipo chocolate-menta y gasolina suave. Un perfil denso y muy “americano”, ideal para extracciones y amantes de sabores intensos.  ￼

El efecto es potente y progresivo: arranca con una euforia marcada que levanta el ánimo, pero rápidamente se transforma en una relajación profunda, casi sedante, típica de las índicas modernas de alto THC.  ￼

👉 En resumen: una genética resinosa y contundente, pensada para quienes buscan sabor complejo + pegada fuerte en formato premium.', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776970385953_0ss3bkjnb01.jpeg', '60% Indica - 40% Sativa ', 26.00, NULL, NULL, NULL, true, '2026-04-23 18:53:11.641208', true, 1500.00, 'exterior', '60% Indica - 40% Sativa', '2026-05-16 01:16:03.271672+00');


--
-- Data for Name: productos_imagenes; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('11372920-044a-4b4d-b468-a189f456d4e8', '1b72b9b0-4f64-45c6-9ad2-df219bc0632d', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776877446800_0yf018wkxa6p.jpeg', 0, '2026-04-22 17:04:17.368077+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('9c8cef3f-6ec5-44d8-9518-e6dce497b89a', '1b72b9b0-4f64-45c6-9ad2-df219bc0632d', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776877453194_6519dlje2z.jpeg', 1, '2026-04-22 17:04:17.842471+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('7b74c7f9-1a15-480d-a7ab-cd5c5fecd617', '1b72b9b0-4f64-45c6-9ad2-df219bc0632d', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776877454628_a4rfn4aptje.jpeg', 2, '2026-04-22 17:04:18.447129+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('f52d33e0-e33d-4e53-a021-0cb8f8473477', '4d33b507-fdd1-449d-bb9a-47fc94d7b517', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776944428814_u8qewiozqjn.jpeg', 0, '2026-04-23 11:40:43.309165+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('da6af3d5-b5ce-4ace-bd9f-6354968ffabd', '4d33b507-fdd1-449d-bb9a-47fc94d7b517', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776944432340_022vjrzx4743.jpeg', 1, '2026-04-23 11:40:43.703918+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('19529255-5407-4e5a-8c8b-5ba6ec60e361', '4d33b507-fdd1-449d-bb9a-47fc94d7b517', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776944436336_04mvycj30a1q.jpeg', 2, '2026-04-23 11:40:44.10147+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('09cc9946-866c-410a-a943-cdcb2e2122a0', '561f2d87-0198-43ed-9976-a9639829a5a5', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776944976046_kzzttvgixo.jpeg', 0, '2026-04-23 11:49:40.091989+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('15ad0a17-fd14-4e2a-ad69-b065056d0af9', '79ad8a0c-6747-49db-a582-b37858630669', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776965751720_42sd2t60xjg.jpeg', 0, '2026-04-23 17:36:07.38607+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('7daaad85-2c24-49b3-8bbb-bf805d6abffe', '79ad8a0c-6747-49db-a582-b37858630669', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776965757191_yq0p8uah2dt.jpeg', 1, '2026-04-23 17:36:07.749812+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('16752af1-fb6c-4396-9485-9ec5e68df160', '79ad8a0c-6747-49db-a582-b37858630669', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776965759231_x1a0pq3q1j9.jpeg', 2, '2026-04-23 17:36:08.149335+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('f8daa76d-cc82-4106-a9b5-36a2c8dc4d54', '1046d072-c450-48e2-89e3-274311d74c2d', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776968397095_adjzj0s9en4.jpeg', 0, '2026-04-23 18:20:24.004914+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('4ea233f3-04f2-45b9-b5fb-8ee068ea6658', '1046d072-c450-48e2-89e3-274311d74c2d', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776968402504_sxk8wd6n6f.jpeg', 1, '2026-04-23 18:20:24.556614+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('13684b5a-1c05-40d5-8c31-612c5e32c4df', '1046d072-c450-48e2-89e3-274311d74c2d', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776968411916_zct9osrmlh.jpeg', 2, '2026-04-23 18:20:25.062655+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('5a00266c-2f39-4f1b-bde9-bcf4613c6e58', 'bd39ea0e-04b3-453d-8b03-97376cee46e2', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776968623228_sx8my5f32mc.jpeg', 0, '2026-04-23 18:23:54.043086+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('be3c6e3d-c59f-4662-b8e8-b9bf5973e14d', 'bd39ea0e-04b3-453d-8b03-97376cee46e2', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776968626042_qwws9n2ode.jpeg', 1, '2026-04-23 18:23:54.627857+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('ee1401cd-57fb-46f3-8179-a97ae8030f01', 'bd39ea0e-04b3-453d-8b03-97376cee46e2', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776968628803_qutph34w89j.jpeg', 2, '2026-04-23 18:23:55.132062+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('a1249a1e-f5c0-4f60-bb42-e17daf27d0f3', '4d5cef31-59f8-4c3d-8ada-1cbb1d3793fc', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776968844580_2j3i66obrs8.jpeg', 0, '2026-04-23 18:27:33.736891+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('cb636c5f-a7ec-41b1-92de-4a90cfcf4166', '4d5cef31-59f8-4c3d-8ada-1cbb1d3793fc', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776968847530_034od8e1efzb.jpeg', 1, '2026-04-23 18:27:34.160442+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('71b70edd-4121-452e-a22e-617b78cbca98', '4d5cef31-59f8-4c3d-8ada-1cbb1d3793fc', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776968849784_vf8gyjykzj.jpeg', 2, '2026-04-23 18:27:34.547155+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('50a97cb3-db09-4c55-8842-f8e9a7b3fc83', '899ec776-471b-41d7-9c99-41064b2f2901', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776969039730_wh60w6ktae.jpeg', 0, '2026-04-23 18:30:50.593646+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('217392a7-8c58-48c6-bf55-a3ae9951218b', '899ec776-471b-41d7-9c99-41064b2f2901', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776969044904_0w05ic5t13up.jpeg', 1, '2026-04-23 18:30:51.043703+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('c53407c0-df1e-4dec-9ff1-0269af9f2432', '899ec776-471b-41d7-9c99-41064b2f2901', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776969047728_tigv4sgeza.jpeg', 2, '2026-04-23 18:30:51.42196+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('64e03f79-c35d-422b-b6c3-2252f899ee17', '6eb76ea1-5b01-4a84-86dc-106a03e19344', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776969374287_a81tzjskedi.jpeg', 0, '2026-04-23 18:36:26.796367+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('c9a7fc96-f659-481c-b7f5-f2833c22881f', '6eb76ea1-5b01-4a84-86dc-106a03e19344', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776969380613_8ucbw3cu1f3.jpeg', 1, '2026-04-23 18:36:27.221502+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('de61c76c-4b67-4275-aa64-632a452fcab3', '6eb76ea1-5b01-4a84-86dc-106a03e19344', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776969382269_ytsu5sv75wc.jpeg', 2, '2026-04-23 18:36:27.607379+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('b8a9df32-b448-40aa-9b2e-cdd1dc5ab1c4', '346571c4-3798-4fce-b902-29fbea9ef8ed', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776969607683_wgytpx1pdu.jpeg', 0, '2026-04-23 18:40:17.190704+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('383eec69-5f44-4678-9050-b0edc4855270', '346571c4-3798-4fce-b902-29fbea9ef8ed', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776969611546_5f9h636lucd.jpeg', 1, '2026-04-23 18:40:17.577615+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('7f4cee15-24b2-4ad8-abb6-6823f46d2bfe', '346571c4-3798-4fce-b902-29fbea9ef8ed', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776969613185_9tsjtvx5mlt.jpeg', 2, '2026-04-23 18:40:17.991388+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('05821277-a3b8-4e8a-bb12-cc37254ebcea', 'e3157122-27fb-497c-9041-e5ce4f093617', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776969851183_tlkzdpzefun.jpeg', 0, '2026-04-23 18:44:26.163101+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('b44aba1d-2391-4d11-ad4d-88e0c1d63f02', 'e3157122-27fb-497c-9041-e5ce4f093617', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776969855466_2ux1p43cgqc.jpeg', 1, '2026-04-23 18:44:27.343071+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('7d9f7910-f3e8-440a-aeeb-29b0e15da738', 'e3157122-27fb-497c-9041-e5ce4f093617', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776969858129_79qhre54iu3.jpeg', 2, '2026-04-23 18:44:28.058492+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('7fecb9c5-c619-4f79-b05b-a6b3cccbd3bc', '7e76174e-bf8e-41c0-b4e9-880b860c228f', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776970385953_0ss3bkjnb01.jpeg', 0, '2026-04-23 18:53:12.062354+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('b6674332-bbed-4ec6-b01f-cb2cfbe7b7ff', '7e76174e-bf8e-41c0-b4e9-880b860c228f', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776970388459_hb6d9vef2ii.jpeg', 1, '2026-04-23 18:53:12.49488+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('7e7ed298-ded0-477e-ac76-16c1f0338280', '73b93602-226c-47a0-a3ef-7ae2f4e12329', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776970547558_7hibl4pnxy4.jpeg', 0, '2026-04-23 18:56:09.775137+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('f3b974ce-2581-4752-ab11-60cb9f27498c', '73b93602-226c-47a0-a3ef-7ae2f4e12329', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776970565927_g68u16lhd.jpeg', 1, '2026-04-23 18:56:10.261267+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('a06840fd-3418-457d-8d75-78e3a458f2b9', 'e66b4d8d-fb56-4b23-b04e-eaba689d5c80', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776970805496_l4uhhxcioxj.jpeg', 0, '2026-04-23 19:00:38.538768+00', '2026-05-16 01:16:03.271672+00');
INSERT INTO public.productos_imagenes (id, producto_id, imagen_url, orden, created_at, updated_at) VALUES ('513db3e4-14af-4b3b-bcd9-0fdaf2a6924e', 'e66b4d8d-fb56-4b23-b04e-eaba689d5c80', 'https://qjiqbcokhlwisxbeplym.supabase.co/storage/v1/object/public/productos/producto_1776970823155_u1xi0jppcce.jpeg', 1, '2026-04-23 19:00:39.378986+00', '2026-05-16 01:16:03.271672+00');


--
-- Data for Name: whatsapp_templates; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.whatsapp_templates (id, clave, nombre_template, idioma, canal, cuerpo, activo, created_at, updated_at) VALUES ('e8188c58-461b-4adb-8315-afc3da829908', 'recordatorio_ultimo_jueves', 'recordatorio_ultimo_jueves', 'es', 'whatsapp', 'Tenes tiempo hasta 72 hs antes del ultimo jueves del mes para confirmar tu retiro.', true, '2026-04-23 16:25:30.977929+00', '2026-04-23 16:25:30.977929+00');
INSERT INTO public.whatsapp_templates (id, clave, nombre_template, idioma, canal, cuerpo, activo, created_at, updated_at) VALUES ('585d538f-a2a5-4577-a26d-bab061f6aa9b', 'recordatorio_primer_jueves', 'recordatorio_primer_jueves', 'es', 'whatsapp', 'Tenes tiempo hasta 48 hs antes del primer jueves del mes para confirmar tu retiro.', true, '2026-04-23 16:25:30.977929+00', '2026-04-23 16:25:30.977929+00');


--
-- Name: configuracion_sistema_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.configuracion_sistema_id_seq', 152, true);


--
-- PostgreSQL database dump complete
--

\unrestrict 6wjVZ6uh1X7ssF19TtIf3oAMABOA1R8XYfxsGdu94W1PnPEWJFxUQHwbDKKAe7p

