package com.meteory.ia;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Random;

public class BaseConocimientoJuegos {

    private static final HashMap<String, HashMap<String, List<String>>> BASE = new HashMap<>();
    private static final Random RANDOM = new Random();

    static {
        // Free Fire
        HashMap<String, List<String>> ff = new HashMap<>();
        List<String> ffRec = new ArrayList<>();
        ffRec.add("Usa escopeta M1014 a corta distancia en casas.");
        ffRec.add("Coloca la pared Gloo levantando la mira para cubrirte al instante.");
        ffRec.add("Mantén el chaleco al nivel 3 antes de buscar enfrentamientos finales.");
        ff.put("REC", ffRec);

        List<String> ffRisa = new ArrayList<>();
        ffRisa.add("¡Tu personaje corre más rápido que yo cuando hay pizza! 🍕");
        ffRisa.add("Esa pared Gloo pareció una cortina de baño 🛁");
        ff.put("RISA", ffRisa);

        List<String> ffBurla = new ArrayList<>();
        ffBurla.add("¿Te eliminaron con una sartén? ¡Eso sí es nivel leyenda! 😂");
        ffBurla.add("Tranquilo, la pared Gloo te protege del viento por lo menos 😏");
        ff.put("BURLA", ffBurla);
        BASE.put("FREE_FIRE", ff);

        // Minecraft
        HashMap<String, List<String>> mc = new HashMap<>();
        List<String> mcRec = new ArrayList<>();
        mcRec.add("Nunca caves directamente hacia abajo.");
        mcRec.add("Lleva siempre un cubo de agua en el acceso rápido.");
        mc.put("REC", mcRec);

        List<String> mcRisa = new ArrayList<>();
        mcRisa.add("Ese creeper te miró con amor explosivo 🧨");
        mc.put("RISA", mcRisa);

        List<String> mcBurla = new ArrayList<>();
        mcBurla.add("¿Otra vez te explotó la base? Ya eres experto en demoliciones 😏");
        mc.put("BURLA", mcBurla);
        BASE.put("MINECRAFT", mc);

        // Generico
        HashMap<String, List<String>> gen = new HashMap<>();
        List<String> genRec = new ArrayList<>();
        genRec.add("FPS estables: cierra aplicaciones en segundo plano.");
        genRec.add("Activa la optimización gráfica si la batería se agota rápido.");
        gen.put("REC", genRec);

        List<String> genRisa = new ArrayList<>();
        genRisa.add("Tu procesador pide un refresco helado 🍦");
        gen.put("RISA", genRisa);

        List<String> genBurla = new ArrayList<>();
        genBurla.add("Jugaste con tanto estilo que asustaste a tus propios FPS 😏");
        gen.put("BURLA", genBurla);
        BASE.put("GENERICO", gen);
    }

    public static String obtenerFrase(String juego, String tipo) {
        String key = juego != null ? juego.toUpperCase().replace(" ", "_") : "GENERICO";
        if (!BASE.containsKey(key)) {
            key = "GENERICO";
        }
        HashMap<String, List<String>> categorias = BASE.get(key);
        if (categorias != null && categorias.containsKey(tipo)) {
            List<String> lista = categorias.get(tipo);
            if (lista != null && !lista.isEmpty()) {
                return lista.get(RANDOM.nextInt(lista.size()));
            }
        }
        return "¡Sigue jugando con todo el poder de Meteory IA! 🚀";
    }
}
