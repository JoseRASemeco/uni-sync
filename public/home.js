// home.js (Frontend)

document.addEventListener('DOMContentLoaded', () => {
    // Ejemplo: Añadir un efecto de desplazamiento suave a los enlaces de anclaje
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();

            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // Puedes añadir más interactividad aquí, como:
    // - Animaciones al hacer scroll
    // - Lógica para un carrusel de testimonios
    // - Validaciones de formularios si hubiera alguno en la página de inicio
});
