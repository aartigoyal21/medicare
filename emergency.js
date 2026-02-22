document.getElementById("emergencyForm")
.addEventListener("submit", async function(e) {

    e.preventDefault();

    const name = document.getElementById("name").value;
    const location = document.getElementById("location").value;

    const response = await fetch("http://localhost:5000/emergency", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ name, location })
    });

    const data = await response.json();

    alert(data.message);
});