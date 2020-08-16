# svelte-labeled-input
css3 layout label transition input text field

![GIF from the labeled input field](./readme-assets/svelte-labeled-input.gif)

## Install

```
npm install svelte-labeled-input
```

[![Donate](https://github.com/ivosdc/svelte-generic-crud-table/raw/master/assets/donate.gif)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=7V5M288MUT7GE&source=url)


# Usage
Import the component.
```
    import LabeledInput from 'svelte-labeled-input'
```

Use the component.
```
    <LabeledInput name="prename"
                  placeholder="Your prename"
                  label="Prename:"
                  bind:value={prename}/>
```

The styled and labeled input "html"-element offers the parameter:
```
    export let name;        // Name of the component in DOM
    export let placeholder; // Placeholder for no input value
    export let value;       // Value of the input field. 
    export let label;       // Label of the input field
```

###  Svelte-Component:
```
<script>
    import LabeledInput from 'svelte-labeled-input'

    let prename;
    let fullname;
</script>

<main>
    <hr>
    <LabeledInput name="prename"
                  placeholder="Your prename"
                  label="Prename:"
                  bind:value={prename}/>
    <LabeledInput name="fullname"
                  placeholder="Your name"
                  label="Family name:"
                  bind:value={fullname}/>
</main>

```
