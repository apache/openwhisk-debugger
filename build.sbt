name := "owdbg"
version := "0.0.1"

val akka = "2.4.10"

scalaVersion := "2.11.6"

libraryDependencies ++= Seq(
  "org.scalatest" %% "scalatest" % "2.2.1",
  "com.typesafe.akka" %% "akka-stream" % akka,
  "com.typesafe.akka" %% "akka-http-core" % akka,
  "com.typesafe.akka" %% "akka-actor" % akka,
  "com.typesafe.akka" %% "akka-http-testkit" % akka,
  "com.typesafe.akka" %% "akka-stream-testkit" % akka
)
