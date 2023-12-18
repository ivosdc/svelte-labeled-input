//config labeled-input


let fields = document.querySelector('labeled-input');

fields[0].setAttribute('shadowed', 'true');

fields[0].addEventListener('input', (e) => {
    console.log('input');
});
