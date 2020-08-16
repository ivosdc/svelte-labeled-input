<svelte:options tag={'labeled-input'}/>
<script>
    export let name;
    export let placeholder;
    export let value;
    export let label;
</script>


<main>
    <div class="field">
        <input bind:value={value} id={name} name={name} placeholder={placeholder} type="text"/>
        <label from={name}>{label}</label>
    </div>
</main>

<style>
    .field {
        display: flex;
        flex-flow: column-reverse;
        margin-bottom: 1.5em;
    }

    label, input {
        transition: all 0.2s;
        touch-action: manipulation;
    }

    label {
        position: relative;
        font-size: 0.8em;
        top: 0em;
    }

    input {
        font-size: 1em;
        border: 0;
        border-bottom: 1px solid #ccc;
        font-family: inherit;
        font-size: 1em;
        font-weight: 200;
        -webkit-appearance: none;
        border-radius: 0;
        padding: 0;
        cursor: text;
    }

    input:focus {
        outline: 0;
        border-bottom: 1px solid #666;
    }

    input:placeholder-shown + label {
        cursor: text;
        max-width: 0%;
        white-space: nowrap;
        overflow: unset;
        text-overflow: ellipsis;
        transform-origin: left top;
        transform: translate(0, 1.2em) scale(1.2);
    }

    ::-webkit-input-placeholder {
        opacity: 0;
        transition: inherit;
    }

    ::-moz-placeholder {
        opacity: 0;
        transition: inherit;
    }

    input:focus::-webkit-input-placeholder {
        opacity: 0.5;
    }

    input:focus::-moz-placeholder {
        opacity: 0.5;
    }

    input:not(:placeholder-shown) + label,
    input:focus + label {
        transform: translate(0, 0) scale(1);
        cursor: pointer;
    }
</style>
<!-- your code here -->
